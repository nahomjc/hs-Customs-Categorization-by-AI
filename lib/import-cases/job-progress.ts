/**
 * Shared engine for client-driven, batched jobs (harmonization, classification).
 *
 * A job talks to the server in short idempotent requests and keeps all state in
 * the browser, so nothing depends on server memory. This file has the parts that
 * do not depend on what the job does: status, retry rules, stop/resume, elapsed
 * time, ETA and the display helpers. Every number comes from real responses.
 */

/** Stop the run after this many request-level failures in a row. */
export const MAX_CONSECUTIVE_BATCH_ERRORS = 3;

export type JobStatus =
  | "running"
  | "stopping"
  | "stopped"
  | "success"
  | "partial"
  | "failed";

export type JobFailure = { sequence: number; error: string };

/** Error carrying the HTTP status so the job can decide whether to retry. */
export class JobApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "JobApiError";
    this.status = status;
  }
}

/** Fields every job snapshot has, whatever the job does. */
export type BaseJobSnapshot = {
  status: JobStatus;
  stage: string;
  /** Items finished (ok or failed) in the current stage. */
  stageProcessed: number;
  /** Items in the current stage (0 when the stage is a single request). */
  stageTotal: number;
  /** Items already finished when the current stage (re)started. */
  stageBaseline: number;
  stageStartedAt: number | null;
  /** Time spent while running, excluding the current segment. */
  accumulatedMs: number;
  segmentStartedAt: number | null;
  fatalError: string | null;
};

export type BatchJobOptions<S> = {
  onUpdate?: (snapshot: S) => void;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  retryDelayMs?: number;
};

/** What the React hook needs from a job. */
export interface BatchJobLike<S extends { status: JobStatus }> {
  run(): Promise<S>;
  retryFailed(): Promise<S>;
  requestStop(): void;
  snapshot(): S;
  readonly isRunning: boolean;
}

const FATAL_STATUSES = new Set([400, 401, 403, 404, 409]);

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  if (status === undefined) return true; // network error
  return status >= 500 || status === 429;
}

export function isFatal(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return status !== undefined && FATAL_STATUSES.has(status);
}

export function toFailures(map: Map<number, string>): JobFailure[] {
  return [...map.entries()]
    .map(([sequence, error]) => ({ sequence, error }))
    .sort((a, b) => a.sequence - b.sequence);
}

export abstract class BatchJobBase<S extends BaseJobSnapshot>
  implements BatchJobLike<S>
{
  protected readonly baseOpts: Required<
    Pick<BatchJobOptions<S>, "now" | "sleep" | "retryDelayMs">
  > &
    Pick<BatchJobOptions<S>, "onUpdate">;

  protected status: JobStatus = "running";
  protected stage: string = "preparing";
  protected stageTotal = 0;
  protected stageBaseline = 0;
  protected stageProcessed = 0;
  protected stageStartedAt: number | null = null;
  protected accumulatedMs = 0;
  protected segmentStartedAt: number | null = null;
  protected fatalError: string | null = null;
  protected stopRequested = false;
  private running = false;

  constructor(options: BatchJobOptions<S> = {}) {
    this.baseOpts = {
      onUpdate: options.onUpdate,
      now: options.now ?? (() => Date.now()),
      sleep:
        options.sleep ??
        ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms))),
      retryDelayMs: options.retryDelayMs ?? 800,
    };
  }

  abstract snapshot(): S;
  /** Do the work from wherever the job is. Set `this.status` when finished. */
  protected abstract drive(): Promise<void>;
  /** Put failed items back in the queue, then call `this.run()`. */
  abstract retryFailed(): Promise<S>;

  get isRunning(): boolean {
    return this.running;
  }

  protected baseSnapshot(): BaseJobSnapshot {
    return {
      status: this.status,
      stage: this.stage,
      stageProcessed: this.stageProcessed,
      stageTotal: this.stageTotal,
      stageBaseline: this.stageBaseline,
      stageStartedAt: this.stageStartedAt,
      accumulatedMs: this.accumulatedMs,
      segmentStartedAt: this.segmentStartedAt,
      fatalError: this.fatalError,
    };
  }

  /** Ask the job to stop after the batch that is in flight. */
  requestStop(): void {
    if (!this.running) return;
    this.stopRequested = true;
    this.status = "stopping";
    this.emit();
  }

  /**
   * Start, or continue from where the job stopped. Safe to call again after
   * "stopped" or "failed": finished items are never redone.
   */
  async run(): Promise<S> {
    if (this.running) return this.snapshot();
    this.running = true;
    this.stopRequested = false;
    this.status = "running";
    this.fatalError = null;
    this.segmentStartedAt = this.baseOpts.now();
    this.emit();

    try {
      await this.drive();
    } catch (error) {
      this.fatalError = messageOf(error);
      this.status = "failed";
    } finally {
      this.endSegment();
      this.running = false;
      this.emit();
    }
    return this.snapshot();
  }

  protected emit(): void {
    this.baseOpts.onUpdate?.(this.snapshot());
  }

  protected endSegment(): void {
    if (this.segmentStartedAt !== null) {
      this.accumulatedMs += Math.max(
        0,
        this.baseOpts.now() - this.segmentStartedAt,
      );
      this.segmentStartedAt = null;
    }
  }

  protected setStage(stage: string, total: number, baseline: number): void {
    this.stage = stage;
    this.stageTotal = total;
    this.stageBaseline = baseline;
    this.stageProcessed = baseline;
    this.stageStartedAt = this.baseOpts.now();
    this.emit();
  }

  /** Call `fn`; on a retryable error wait and try exactly once more. */
  protected async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (first) {
      if (!isRetryable(first)) throw first;
      await this.baseOpts.sleep(this.baseOpts.retryDelayMs);
      return fn(); // one retry; its error propagates
    }
  }

  protected halted(): boolean {
    return this.stopRequested;
  }
}

/* ------------------------------ item queue job ------------------------------ */

/** One server answer per item (sequence). */
export type ItemResult =
  | { sequence: number; ok: true }
  | { sequence: number; ok: false; error: string };

export interface QueueJobApi<R extends ItemResult, Summary> {
  start(): Promise<{ planKey: string; total: number; sequences: number[] }>;
  products(planKey: string, sequences: number[]): Promise<R[]>;
  finalize(planKey: string): Promise<Summary>;
}

/**
 * A job with one item stage: start (plan) -> short batches of items ->
 * finalize. Classification and grouping both run on this. Items are keyed by
 * sequence number, finished items are never redone, failed ones are retried
 * once and can be retried later with retryFailed().
 */
export abstract class QueueBatchJob<
  S extends BaseJobSnapshot,
  R extends ItemResult,
  Summary,
> extends BatchJobBase<S> {
  protected planKey: string | null = null;
  protected total = 0;
  protected queue: number[] = [];
  protected readonly failed = new Map<number, string>();
  protected summary: Summary | null = null;

  constructor(
    protected readonly api: QueueJobApi<R, Summary>,
    private readonly batchSize: number,
    private readonly itemStage: string,
    private readonly itemNoun: string,
    private readonly emptyMessage: string,
    options: BatchJobOptions<S>,
  ) {
    super(options);
  }

  /** Called once with the plan the server returned (extra fields included). */
  protected onStart(start: { planKey: string; total: number; sequences: number[] }): void {
    void start;
  }

  /** Count one successful result in the subclass counters. */
  protected abstract applyOk(result: Extract<R, { ok: true }>): void;

  /** Put failed items back in the queue and continue. */
  async retryFailed(): Promise<S> {
    if (this.isRunning) return this.snapshot();
    for (const sequence of this.failed.keys()) this.queue.push(sequence);
    this.failed.clear();
    this.queue.sort((a, b) => a - b);
    return this.run();
  }

  protected async drive(): Promise<void> {
    // 1. plan
    if (this.planKey === null) {
      this.setStage("preparing", 0, 0);
      const start = await this.withRetry(() => this.api.start());
      if (start.total === 0) throw new Error(this.emptyMessage);
      this.planKey = start.planKey;
      this.total = start.total;
      this.queue = [...start.sequences];
      this.onStart(start);
      this.emit();
    }
    if (this.halted()) {
      this.status = "stopped";
      return;
    }

    // 2. items in short batches
    if (this.queue.length > 0) {
      this.setStage(this.itemStage, this.total, this.total - this.queue.length);
      let consecutiveErrors = 0;
      while (this.queue.length > 0 && !this.halted()) {
        const batch = this.queue.splice(0, this.batchSize);
        const failedRequest = await this.runBatch(batch);
        consecutiveErrors = failedRequest ? consecutiveErrors + 1 : 0;
        if (consecutiveErrors >= MAX_CONSECUTIVE_BATCH_ERRORS) {
          this.queue = [];
          this.fatalError = `Stopped after ${MAX_CONSECUTIVE_BATCH_ERRORS} failed requests in a row. Check your connection and retry the failed ${this.itemNoun}.`;
          this.status = "failed";
          return;
        }
      }
    }
    if (this.halted()) {
      this.status = "stopped";
      return;
    }
    if (this.failed.size > 0) {
      this.status = "partial";
      return;
    }

    // 3. finalize
    this.setStage("finalizing", 0, 0);
    this.summary = await this.withRetry(() =>
      this.api.finalize(this.planKey as string),
    );
    this.status = "success";
    this.emit();
  }

  /** Returns true when the request itself failed (not just some items). */
  private async runBatch(batch: number[]): Promise<boolean> {
    const planKey = this.planKey as string;
    let results: R[];
    try {
      results = await this.withRetry(() => this.api.products(planKey, batch));
    } catch (error) {
      if (isFatal(error)) {
        // nothing was processed: keep the batch queued so a resume redoes it
        this.queue.unshift(...batch);
        throw error;
      }
      for (const sequence of batch) this.failed.set(sequence, messageOf(error));
      this.stageProcessed += batch.length;
      this.emit();
      return true;
    }

    this.applyResults(batch, results, false);

    // Retry the items that failed inside an otherwise good batch, once.
    const failedNow = batch.filter((s) => this.failed.has(s));
    if (failedNow.length > 0 && !this.halted()) {
      for (const sequence of failedNow) this.failed.delete(sequence);
      this.stageProcessed -= failedNow.length;
      try {
        const again = await this.api.products(planKey, failedNow);
        this.applyResults(failedNow, again, true);
      } catch (error) {
        for (const sequence of failedNow) {
          this.failed.set(sequence, messageOf(error));
        }
        this.stageProcessed += failedNow.length;
        this.emit();
        if (isFatal(error)) throw error;
      }
    }
    return false;
  }

  private applyResults(expected: number[], results: R[], isRetry: boolean): void {
    const seen = new Set<number>();
    for (const result of results) {
      if (!expected.includes(result.sequence) || seen.has(result.sequence)) {
        continue;
      }
      seen.add(result.sequence);
      if (result.ok) {
        this.failed.delete(result.sequence);
        this.applyOk(result as Extract<R, { ok: true }>);
      } else {
        this.failed.set(result.sequence, result.error);
      }
      this.stageProcessed += 1;
    }
    // A sequence the server did not answer for counts as failed, never as done.
    for (const sequence of expected) {
      if (seen.has(sequence)) continue;
      this.failed.set(
        sequence,
        isRetry ? "No result returned after retry" : "No result returned",
      );
      this.stageProcessed += 1;
    }
    this.emit();
  }
}

/* ------------------------------ pure display helpers ------------------------------ */

/** Whole percent 0-100; 100 only when everything is done. Never NaN. */
export function percentOf(processed: number, total: number): number {
  if (!Number.isFinite(processed) || !Number.isFinite(total) || total <= 0) return 0;
  const ratio = Math.min(Math.max(processed / total, 0), 1);
  return ratio >= 1 ? 100 : Math.floor(ratio * 100);
}

/** Time the job has actually been running. */
export function elapsedMs(snapshot: BaseJobSnapshot, now: number): number {
  const live =
    snapshot.segmentStartedAt !== null
      ? Math.max(0, now - snapshot.segmentStartedAt)
      : 0;
  return snapshot.accumulatedMs + live;
}

export const ETA_MIN_ITEMS = 3;
export const ETA_MIN_ELAPSED_MS = 3000;

/**
 * Rough time left in the current stage, or null until enough items finished
 * to measure a speed (at least 3 items and 3 seconds in this stage). Stages
 * that are a single request have stageTotal 0 and never get an ETA.
 */
export function etaMs(snapshot: BaseJobSnapshot, now: number): number | null {
  if (snapshot.status !== "running") return null;
  if (snapshot.stageStartedAt === null || snapshot.stageTotal <= 0) return null;
  const done = snapshot.stageProcessed - snapshot.stageBaseline;
  const remaining = snapshot.stageTotal - snapshot.stageProcessed;
  const elapsed = now - snapshot.stageStartedAt;
  if (done < ETA_MIN_ITEMS || elapsed < ETA_MIN_ELAPSED_MS || remaining <= 0) {
    return null;
  }
  return Math.round((elapsed / done) * remaining);
}

/** 42s, 3m 07s, 1h 02m. Never NaN. */
export function formatDuration(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  if (safe < 60) return `${safe}s`;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes < 60) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}