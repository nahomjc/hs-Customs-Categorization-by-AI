/**
 * Client-driven harmonization job (no React, no fetch): it talks to an injected
 * `HarmonizeApi`, so the batching, retry and progress logic can be tested
 * offline.
 *
 * Every number in a snapshot is counted from real server responses. Nothing is
 * estimated except the ETA, which is only offered once enough batches finished.
 */
import { chunk, sequenceRange } from "./harmonize-plan";
import {
  BatchJobBase,
  JobApiError,
  MAX_CONSECUTIVE_BATCH_ERRORS,
  isFatal,
  messageOf,
  toFailures,
  type BaseJobSnapshot,
  type BatchJobOptions,
  type JobFailure,
  type JobStatus,
} from "./job-progress";

// Shared engine pieces, re-exported so existing imports keep working.
export {
  ETA_MIN_ELAPSED_MS,
  ETA_MIN_ITEMS,
  MAX_CONSECUTIVE_BATCH_ERRORS,
  elapsedMs,
  etaMs,
  formatDuration,
  percentOf,
  type JobFailure,
  type JobStatus,
} from "./job-progress";

export const PRODUCT_BATCH_SIZE = 6;
export const VDD_BATCH_SIZE = 10;

export type HarmonizeStage = "preparing" | "products" | "vdd" | "finalizing";

export const STAGE_ORDER: readonly HarmonizeStage[] = [
  "preparing",
  "products",
  "vdd",
  "finalizing",
];

export const STAGE_LABELS: Record<HarmonizeStage, string> = {
  preparing: "Grouping invoice and packing lines",
  products: "Normalizing and saving products",
  vdd: "Searching VDD references",
  finalizing: "Saving case status",
};

export type HarmonizeSummary = {
  productCount: number;
  matchCount: number;
  unmatchedInvoiceCount: number;
  unmatchedPackingCount: number;
  vddMatchTotal: number;
};

export type StartResponse = {
  planKey: string;
  total: number;
  matchCount: number;
  unmatchedInvoiceCount: number;
  unmatchedPackingCount: number;
};

export type ProductBatchResult =
  | { sequence: number; ok: true; status: string; reused?: boolean }
  | { sequence: number; ok: false; error: string };

export type VddBatchResult =
  | { sequence: number; ok: true; matchCount: number }
  | { sequence: number; ok: false; error: string };

export interface HarmonizeApi {
  start(): Promise<StartResponse>;
  products(planKey: string, sequences: number[]): Promise<ProductBatchResult[]>;
  vdd(sequences: number[]): Promise<VddBatchResult[]>;
  finalize(planKey: string): Promise<HarmonizeSummary>;
}

/** Error carrying the HTTP status so the job can decide whether to retry. */
export const HarmonizeApiError = JobApiError;
export type HarmonizeApiError = JobApiError;

export type JobSnapshot = BaseJobSnapshot & {
  status: JobStatus;
  stage: HarmonizeStage;
  /** Products this run creates (0 until the plan is known). */
  total: number;
  /** Items finished (ok or failed) in the current stage. */
  stageProcessed: number;
  /** Items in the current stage (0 when the stage is a single request). */
  stageTotal: number;
  /** Items already finished when the current stage (re)started. */
  stageBaseline: number;
  stageStartedAt: number | null;
  /** Products saved with status ready_for_hs_suggestion. */
  ready: number;
  /** Products saved with status needs_information. */
  needsReview: number;
  productFailures: JobFailure[];
  vddFailures: JobFailure[];
  vddHits: number;
  /** Time spent while running, excluding the current segment. */
  accumulatedMs: number;
  segmentStartedAt: number | null;
  summary: HarmonizeSummary | null;
  fatalError: string | null;
};

export type HarmonizeJobOptions = BatchJobOptions<JobSnapshot> & {
  productBatchSize?: number;
  vddBatchSize?: number;
};

export class HarmonizeJob extends BatchJobBase<JobSnapshot> {
  private readonly api: HarmonizeApi;
  private readonly productBatchSize: number;
  private readonly vddBatchSize: number;

  private planKey: string | null = null;
  private total = 0;
  private productQueue: number[] = [];
  private vddQueue: number[] = [];
  private readonly productFailed = new Map<number, string>();
  private readonly vddFailed = new Map<number, string>();
  private readyCount = 0;
  private needsReviewCount = 0;
  private vddHits = 0;
  private vddHitsSinceSummary = 0;
  private summary: HarmonizeSummary | null = null;

  constructor(api: HarmonizeApi, options: HarmonizeJobOptions = {}) {
    super(options);
    this.api = api;
    this.productBatchSize = Math.max(1, options.productBatchSize ?? PRODUCT_BATCH_SIZE);
    this.vddBatchSize = Math.max(1, options.vddBatchSize ?? VDD_BATCH_SIZE);
  }

  snapshot(): JobSnapshot {
    return {
      ...this.baseSnapshot(),
      stage: this.stage as HarmonizeStage,
      total: this.total,
      ready: this.readyCount,
      needsReview: this.needsReviewCount,
      productFailures: toFailures(this.productFailed),
      vddFailures: toFailures(this.vddFailed),
      vddHits: this.vddHits,
      summary: this.summary ? { ...this.summary } : null,
    };
  }

  /** Put failed products / VDD searches back in the queue and continue. */
  async retryFailed(): Promise<JobSnapshot> {
    if (this.isRunning) return this.snapshot();
    for (const sequence of this.productFailed.keys()) {
      this.productQueue.push(sequence);
    }
    this.productFailed.clear();
    for (const sequence of this.vddFailed.keys()) {
      this.vddQueue.push(sequence);
    }
    this.vddFailed.clear();
    this.productQueue.sort((a, b) => a - b);
    this.vddQueue.sort((a, b) => a - b);
    return this.run();
  }

  /* ------------------------------ internals ------------------------------ */

  protected async drive(): Promise<void> {
    // 1. plan
    if (this.planKey === null) {
      this.setStage("preparing", 0, 0);
      const start = await this.withRetry(() => this.api.start());
      if (start.total === 0) throw new Error("No products to create");
      this.planKey = start.planKey;
      this.total = start.total;
      this.productQueue = sequenceRange(start.total);
      this.emit();
    }
    if (this.halted()) return this.finishStopped();

    // 2. products
    if (this.productQueue.length > 0) {
      const baseline = this.total - this.productQueue.length;
      this.setStage("products", this.total, baseline);
      let consecutiveErrors = 0;
      while (this.productQueue.length > 0 && !this.halted()) {
        const batch = this.productQueue.splice(0, this.productBatchSize);
        const failedRequest = await this.runProductBatch(batch);
        consecutiveErrors = failedRequest ? consecutiveErrors + 1 : 0;
        if (consecutiveErrors >= MAX_CONSECUTIVE_BATCH_ERRORS) {
          this.productQueue = [];
          this.fatalError = `Stopped after ${MAX_CONSECUTIVE_BATCH_ERRORS} failed requests in a row. Check your connection and retry the failed products.`;
          this.status = "failed";
          return;
        }
      }
    }
    if (this.status === "failed") return;
    if (this.halted()) return this.finishStopped();
    if (this.productFailed.size > 0) {
      this.status = "partial";
      return;
    }

    // 3. VDD references (decision support; failures are not fatal)
    if (this.vddQueue.length > 0) {
      const baseline = this.total - this.vddQueue.length;
      this.setStage("vdd", this.total, baseline);
      let consecutiveErrors = 0;
      while (this.vddQueue.length > 0 && !this.halted()) {
        const batch = this.vddQueue.splice(0, this.vddBatchSize);
        const failedRequest = await this.runVddBatch(batch);
        consecutiveErrors = failedRequest ? consecutiveErrors + 1 : 0;
        if (consecutiveErrors >= MAX_CONSECUTIVE_BATCH_ERRORS) {
          for (const sequence of this.vddQueue) {
            this.vddFailed.set(sequence, "Skipped after repeated request failures");
          }
          this.vddQueue = [];
        }
      }
    }
    if (this.halted()) return this.finishStopped();

    // 4. finalize
    if (this.summary === null) {
      this.setStage("finalizing", 0, 0);
      this.summary = await this.withRetry(() =>
        this.api.finalize(this.planKey as string),
      );
    } else {
      // Retried VDD searches after a finished run: previously failed products
      // had no stored matches, so the new hits can simply be added.
      this.summary = {
        ...this.summary,
        vddMatchTotal: this.summary.vddMatchTotal + this.vddHitsSinceSummary,
      };
    }
    this.vddHitsSinceSummary = 0;
    this.status = "success";
    this.emit();
  }

  private finishStopped(): void {
    this.status = "stopped";
  }

  /** Returns true when the request itself failed (not just some products). */
  private async runProductBatch(batch: number[]): Promise<boolean> {
    const planKey = this.planKey as string;
    let results: ProductBatchResult[];
    try {
      results = await this.withRetry(() => this.api.products(planKey, batch));
    } catch (error) {
      if (isFatal(error)) {
        // nothing was processed: keep the batch queued so a resume redoes it
        this.productQueue.unshift(...batch);
        throw error;
      }
      for (const sequence of batch) {
        this.productFailed.set(sequence, messageOf(error));
      }
      this.stageProcessed += batch.length;
      this.emit();
      return true;
    }

    this.applyProductResults(batch, results, false);

    // Retry the products that failed inside an otherwise good batch, once.
    const failed = batch.filter((s) => this.productFailed.has(s));
    if (failed.length > 0 && !this.halted()) {
      for (const sequence of failed) this.productFailed.delete(sequence);
      this.stageProcessed -= failed.length;
      try {
        const again = await this.api.products(planKey, failed);
        this.applyProductResults(failed, again, true);
      } catch (error) {
        for (const sequence of failed) {
          this.productFailed.set(sequence, messageOf(error));
        }
        this.stageProcessed += failed.length;
        this.emit();
        if (isFatal(error)) throw error;
      }
    }
    return false;
  }

  private applyProductResults(
    expected: number[],
    results: ProductBatchResult[],
    isRetry: boolean,
  ): void {
    const seen = new Set<number>();
    for (const result of results) {
      if (!expected.includes(result.sequence) || seen.has(result.sequence)) {
        continue;
      }
      seen.add(result.sequence);
      if (result.ok) {
        this.productFailed.delete(result.sequence);
        if (result.status === "needs_information") this.needsReviewCount += 1;
        else this.readyCount += 1;
        this.vddQueue.push(result.sequence);
      } else {
        this.productFailed.set(result.sequence, result.error);
      }
      this.stageProcessed += 1;
    }
    // A sequence the server did not answer for counts as failed, never as done.
    for (const sequence of expected) {
      if (seen.has(sequence)) continue;
      this.productFailed.set(
        sequence,
        isRetry ? "No result returned after retry" : "No result returned",
      );
      this.stageProcessed += 1;
    }
    this.emit();
  }

  private async runVddBatch(batch: number[]): Promise<boolean> {
    let results: VddBatchResult[];
    try {
      results = await this.withRetry(() => this.api.vdd(batch));
    } catch (error) {
      if (isFatal(error)) {
        this.vddQueue.unshift(...batch);
        throw error;
      }
      for (const sequence of batch) this.vddFailed.set(sequence, messageOf(error));
      this.stageProcessed += batch.length;
      this.emit();
      return true;
    }
    const seen = new Set<number>();
    for (const result of results) {
      if (!batch.includes(result.sequence) || seen.has(result.sequence)) continue;
      seen.add(result.sequence);
      if (result.ok) {
        this.vddFailed.delete(result.sequence);
        this.vddHits += result.matchCount;
        this.vddHitsSinceSummary += result.matchCount;
      } else {
        this.vddFailed.set(result.sequence, result.error);
      }
      this.stageProcessed += 1;
    }
    for (const sequence of batch) {
      if (!seen.has(sequence)) {
        this.vddFailed.set(sequence, "No result returned");
        this.stageProcessed += 1;
      }
    }
    this.emit();
    return false;
  }
}

/** Re-exported for tests and callers that only need batching. */
export { chunk };