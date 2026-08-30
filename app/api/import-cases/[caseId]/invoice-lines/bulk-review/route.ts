import { createBulkReviewRoute } from "@/lib/import-cases/bulk-review-route";
import { bulkReviewInvoiceLines } from "@/lib/import-cases/bulk-review";

export const POST = createBulkReviewRoute(
  async (caseId, tenantId, userId, action, options) =>
    bulkReviewInvoiceLines(caseId, tenantId, userId, action, options.reason),
);
