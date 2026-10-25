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

/**
 * `scope: "suspicious"` re-checks only the products whose current code does not
 * fit the product. The product numbers chosen at the start are sent with every
 * later request, so each batch stays inside that group.
 */
export function createClassifyApi(
  caseId: string,
  scope?: "suspicious",
): ClassifyApi {
  const url = `/api/import-cases/${caseId}/classify`;
  let scopeSequences: number[] | undefined;
  const scoped = (body: Record<string, unknown>) =>
    scopeSequences ? { ...body, scopeSequences } : body;
  return {
    start: async () => {
      const info = await postJobRequest<ClassifyStartResponse>(
        url,
        scope ? { action: "start", scope } : { action: "start" },
      );
      if (scope) scopeSequences = info.sequences;
      return info;
    },
    products: async (planKey, sequences) =>
      (
        await postJobRequest<{ results: ClassifyBatchResult[] }>(
          url,
          // Same AI+web strength as row Ask AI so Classify fills codes instead
          // of leaving catch-all / "Not classified" for a later per-row click.
          scoped({ action: "products", planKey, sequences, forceAi: true }),
        )
      ).results,
    finalize: (planKey) =>
      postJobRequest<ClassifySummary>(url, scoped({ action: "finalize", planKey })),
  };
}

type Options = {
  /** Called whenever a run ends (success, stopped, partial or failed). */
  onFinished?: (snapshot: ClassifySnapshot) => void;
  /** Read when a run starts: "suspicious" = re-check only codes that do not fit. */
  getScope?: () => "suspicious" | undefined;
};

/** React wrapper around ClassifyJob. */
export function useClassifyJob(caseId: string, options: Options = {}) {
  return useBatchJob<ClassifySnapshot>(
    (onUpdate) =>
      new ClassifyJob(createClassifyApi(caseId, options.getScope?.()), { onUpdate }),
    options,
  );
}