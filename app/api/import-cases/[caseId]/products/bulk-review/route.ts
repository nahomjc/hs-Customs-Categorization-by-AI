import { createBulkReviewRoute } from "@/lib/import-cases/bulk-review-route";
import { bulkReviewProducts } from "@/lib/import-cases/bulk-review";

export const POST = createBulkReviewRoute(
  async (caseId, tenantId, userId, action, options) =>
    bulkReviewProducts(caseId, tenantId, userId, action, options.reason),
);
