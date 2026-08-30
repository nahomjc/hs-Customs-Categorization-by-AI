import { createBulkReviewRoute } from "@/lib/import-cases/bulk-review-route";
import { bulkReviewPackingListLines } from "@/lib/import-cases/bulk-review";

export const POST = createBulkReviewRoute(
  async (caseId, tenantId, userId, action, options) =>
    bulkReviewPackingListLines(caseId, tenantId, userId, action, options.reason),
);
