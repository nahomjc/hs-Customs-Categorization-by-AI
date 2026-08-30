import { createBulkReviewRoute } from "@/lib/import-cases/bulk-review-route";
import { bulkReviewChecks } from "@/lib/import-cases/bulk-review";

export const POST = createBulkReviewRoute(
  async (caseId, tenantId, userId, action, options) =>
    bulkReviewChecks(caseId, tenantId, userId, action, options.reason),
);
