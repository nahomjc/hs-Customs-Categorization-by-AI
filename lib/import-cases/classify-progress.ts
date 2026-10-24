/**
 * Client-driven classification job (no React, no fetch). Built on the shared
 * queue engine in job-progress.ts and talking to an injected `ClassifyApi`, so
 * batching, retry, stop/resume and progress can be tested offline.
 *
 * Every number in a snapshot is counted from real server responses.
 */
import {
  QueueBatchJob,
  toFailures,
  type BaseJobSnapshot,
  type BatchJobOptions,
  type JobFailure,
} from "./job-progress";

export const CLASSIFY_BATCH_SIZE = 4;

export type ClassifyStage = "preparing" | "classifying" | "finalizing";

export const CLASSIFY_STAGE_ORDER: readonly ClassifyStage[] = [
  "preparing",
  "classifying",
  "finalizing",
];

export const CLASSIFY_STAGE_LABELS: Record<ClassifyStage, string> = {
  preparing: "Choosing products and clearing old suggestions",
  classifying: "Tariff reference, VDD and AI with HS chapter notes",
  finalizing: "Saving case status",
};

export type ClassifySummary = {
  classifiedCount: number;
  needsReviewCount: number;
  skippedCount: number;
  referencePopulated: boolean;
};

export type ClassifyStartResponse = {
  planKey: string;
  total: number;
  sequences: number[];
  referencePopulated: boolean;
  /** Re-check run: approved products that went back to review. */
  resetApproved?: number;
  /** Re-check run: declaration groups exist and must be built again. */
  groupingStale?: boolean;
};

export type ClassifyBatchResult =
  | {
      sequence: number;
      ok: true;
      outcome: "classified" | "needs_review" | "skipped";
      viaReference: boolean;
      reused?: boolean;
    }
  | { sequence: number; ok: false; error: string };

export interface ClassifyApi {
  start(): Promise<ClassifyStartResponse>;
  products(planKey: string, sequences: number[]): Promise<ClassifyBatchResult[]>;
  finalize(planKey: string): Promise<ClassifySummary>;
}

export type ClassifySnapshot = BaseJobSnapshot & {
  stage: ClassifyStage;
  /** Products this run classifies (0 until the plan is known). */
  total: number;
  classified: number;
  needsReview: number;
  /** Empty description: nothing to classify. */
  skipped: number;
  /** Suggested from the tariff reference or VDD without an AI call. */
  viaReference: number;
  failures: JobFailure[];
  summary: ClassifySummary | null;
};

export type ClassifyJobOptions = BatchJobOptions<ClassifySnapshot> & {
  batchSize?: number;
};

export class ClassifyJob extends QueueBatchJob<
  ClassifySnapshot,
  ClassifyBatchResult,
  ClassifySummary
> {
  private classifiedCount = 0;
  private needsReviewCount = 0;
  private skippedCount = 0;
  private viaReferenceCount = 0;

  constructor(api: ClassifyApi, options: ClassifyJobOptions = {}) {
    super(
      api,
      Math.max(1, options.batchSize ?? CLASSIFY_BATCH_SIZE),
      "classifying",
      "products",
      "No products to classify",
      options,
    );
  }

  snapshot(): ClassifySnapshot {
    return {
      ...this.baseSnapshot(),
      stage: this.stage as ClassifyStage,
      total: this.total,
      classified: this.classifiedCount,
      needsReview: this.needsReviewCount,
      skipped: this.skippedCount,
      viaReference: this.viaReferenceCount,
      failures: toFailures(this.failed),
      summary: this.summary ? { ...this.summary } : null,
    };
  }

  protected applyOk(result: Extract<ClassifyBatchResult, { ok: true }>): void {
    if (result.outcome === "needs_review") this.needsReviewCount += 1;
    else if (result.outcome === "skipped") this.skippedCount += 1;
    else this.classifiedCount += 1;
    if (result.viaReference) this.viaReferenceCount += 1;
  }
}