/**
 * Client-driven declaration grouping job (no React, no fetch). Built on the
 * shared queue engine in job-progress.ts and talking to an injected
 * `GroupingApi`, so it can be tested offline.
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

export const GROUPING_BATCH_SIZE = 8;

export type GroupingStage = "preparing" | "writing" | "finalizing";

export const GROUPING_STAGE_ORDER: readonly GroupingStage[] = [
  "preparing",
  "writing",
  "finalizing",
];

export const GROUPING_STAGE_LABELS: Record<GroupingStage, string> = {
  preparing: "Reading final HS classifications and building groups",
  writing: "Saving declaration groups",
  finalizing: "Writing the audit entry",
};

export type GroupingSummary = {
  groupCount: number;
  productCount: number;
};

export type GroupingStartResponse = {
  planKey: string;
  /** Number of declaration groups this run writes. */
  total: number;
  /** Group numbers 1..total. */
  sequences: number[];
  /** Approved products being grouped. */
  productCount: number;
};

export type GroupingBatchResult =
  | {
      sequence: number;
      ok: true;
      productCount: number;
      totalQuantity: number;
      reused?: boolean;
    }
  | { sequence: number; ok: false; error: string };

export interface GroupingApi {
  start(): Promise<GroupingStartResponse>;
  products(planKey: string, sequences: number[]): Promise<GroupingBatchResult[]>;
  finalize(planKey: string): Promise<GroupingSummary>;
}

export type GroupingSnapshot = BaseJobSnapshot & {
  stage: GroupingStage;
  /** Declaration groups this run writes (0 until the plan is known). */
  total: number;
  /** Approved products that go into those groups. */
  productTotal: number;
  /** Groups saved. */
  groups: number;
  /** Products inside the saved groups. */
  products: number;
  /** Sum of the quantities of the saved groups. */
  quantity: number;
  failures: JobFailure[];
  summary: GroupingSummary | null;
};

export type GroupingJobOptions = BatchJobOptions<GroupingSnapshot> & {
  batchSize?: number;
};

export class GroupingJob extends QueueBatchJob<
  GroupingSnapshot,
  GroupingBatchResult,
  GroupingSummary
> {
  private productTotal = 0;
  private groupsDone = 0;
  private productsDone = 0;
  private quantityDone = 0;

  constructor(api: GroupingApi, options: GroupingJobOptions = {}) {
    super(
      api,
      Math.max(1, options.batchSize ?? GROUPING_BATCH_SIZE),
      "writing",
      "groups",
      "No groups to create",
      options,
    );
  }

  protected override onStart(start: { planKey: string; total: number; sequences: number[] }): void {
    this.productTotal = (start as GroupingStartResponse).productCount;
  }

  snapshot(): GroupingSnapshot {
    return {
      ...this.baseSnapshot(),
      stage: this.stage as GroupingStage,
      total: this.total,
      productTotal: this.productTotal,
      groups: this.groupsDone,
      products: this.productsDone,
      quantity: this.quantityDone,
      failures: toFailures(this.failed),
      summary: this.summary ? { ...this.summary } : null,
    };
  }

  protected applyOk(result: Extract<GroupingBatchResult, { ok: true }>): void {
    this.groupsDone += 1;
    this.productsDone += result.productCount;
    this.quantityDone += result.totalQuantity;
  }
}