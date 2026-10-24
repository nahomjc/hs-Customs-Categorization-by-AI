"use client";

import {
  HarmonizeJob,
  type HarmonizeApi,
  type HarmonizeSummary,
  type JobSnapshot,
  type ProductBatchResult,
  type StartResponse,
  type VddBatchResult,
} from "./harmonize-progress";
import { postJobRequest, useBatchJob } from "./use-batch-job";

export function createHarmonizeApi(caseId: string): HarmonizeApi {
  const url = `/api/import-cases/${caseId}/harmonize`;
  return {
    start: () => postJobRequest<StartResponse>(url, { action: "start" }),
    products: async (planKey, sequences) =>
      (
        await postJobRequest<{ results: ProductBatchResult[] }>(url, {
          action: "products",
          planKey,
          sequences,
        })
      ).results,
    vdd: async (sequences) =>
      (
        await postJobRequest<{ results: VddBatchResult[] }>(url, {
          action: "vdd",
          sequences,
        })
      ).results,
    finalize: (planKey) =>
      postJobRequest<HarmonizeSummary>(url, { action: "finalize", planKey }),
  };
}

type Options = {
  /** Called whenever a run ends (success, stopped, partial or failed). */
  onFinished?: (snapshot: JobSnapshot) => void;
};

/** React wrapper around HarmonizeJob. */
export function useHarmonizeJob(caseId: string, options: Options = {}) {
  return useBatchJob<JobSnapshot>(
    (onUpdate) => new HarmonizeJob(createHarmonizeApi(caseId), { onUpdate }),
    options,
  );
}