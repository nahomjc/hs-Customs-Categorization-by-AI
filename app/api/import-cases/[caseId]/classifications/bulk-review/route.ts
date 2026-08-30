import { createBulkReviewRoute } from "@/lib/import-cases/bulk-review-route";
import { bulkReviewClassifications } from "@/lib/import-cases/bulk-review";

export const POST = createBulkReviewRoute(
  async (caseId, tenantId, userId, action, options) =>
    bulkReviewClassifications(caseId, tenantId, userId, action, {
      reason: options.reason,
      overrideHsCode: options.overrideHsCode,
    }),
);
