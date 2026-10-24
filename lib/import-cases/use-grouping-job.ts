"use client";

import {
  GroupingJob,
  type GroupingApi,
  type GroupingBatchResult,
  type GroupingSnapshot,
  type GroupingStartResponse,
  type GroupingSummary,
} from "./grouping-progress";
import { postJobRequest, useBatchJob } from "./use-batch-job";

export function createGroupingApi(caseId: string): GroupingApi {
  const url = `/api/import-cases/${caseId}/group`;
  return {
    start: () => postJobRequest<GroupingStartResponse>(url, { action: "start" }),
    products: async (planKey, sequences) =>
      (
        await postJobRequest<{ results: GroupingBatchResult[] }>(url, {
          action: "products",
          planKey,
          sequences,
        })
      ).results,
    finalize: (planKey) =>
      postJobRequest<GroupingSummary>(url, { action: "finalize", planKey }),
  };
}

type Options = {
  /** Called whenever a run ends (success, stopped, partial or failed). */
  onFinished?: (snapshot: GroupingSnapshot) => void;
};

/** React wrapper around GroupingJob. */
export function useGroupingJob(caseId: string, options: Options = {}) {
  return useBatchJob<GroupingSnapshot>(
    (onUpdate) => new GroupingJob(createGroupingApi(caseId), { onUpdate }),
    options,
  );
}