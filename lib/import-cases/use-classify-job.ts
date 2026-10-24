"use client";

import {
  ClassifyJob,
  type ClassifyApi,
  type ClassifyBatchResult,
  type ClassifySnapshot,
  type ClassifyStartResponse,
  type ClassifySummary,
} from "./classify-progress";
import { postJobRequest, useBatchJob } from "./use-batch-job";

export function createClassifyApi(caseId: string): ClassifyApi {
  const url = `/api/import-cases/${caseId}/classify`;
  return {
    start: () => postJobRequest<ClassifyStartResponse>(url, { action: "start" }),
    products: async (planKey, sequences) =>
      (
        await postJobRequest<{ results: ClassifyBatchResult[] }>(url, {
          action: "products",
          planKey,
          sequences,
        })
      ).results,
    finalize: (planKey) =>
      postJobRequest<ClassifySummary>(url, { action: "finalize", planKey }),
  };
}

type Options = {
  /** Called whenever a run ends (success, stopped, partial or failed). */
  onFinished?: (snapshot: ClassifySnapshot) => void;
};

/** React wrapper around ClassifyJob. */
export function useClassifyJob(caseId: string, options: Options = {}) {
  return useBatchJob<ClassifySnapshot>(
    (onUpdate) => new ClassifyJob(createClassifyApi(caseId), { onUpdate }),
    options,
  );
}