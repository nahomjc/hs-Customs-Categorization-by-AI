import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/import-cases/api-helpers";
import type { BulkReviewAction } from "@/lib/import-cases/bulk-review";
import {
  getImportCaseById,
  getTenantId,
} from "@/lib/import-cases/queries";
import { bulkReviewSchema } from "@/lib/import-cases/validation";

type BulkReviewHandler = (
  caseId: string,
  tenantId: string,
  userId: string,
  action: BulkReviewAction,
  options: { reason?: string | null; overrideHsCode?: string | null },
) => Promise<{ affectedCount: number; action: BulkReviewAction }>;

export function createBulkReviewRoute(handler: BulkReviewHandler) {
  return async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ caseId: string }> },
  ) {
    const user = await getAuthUser();
    if (!user?.id) return unauthorizedResponse();

    const { caseId } = await params;
    const tenantId = getTenantId();
    const importCase = await getImportCaseById(caseId, tenantId);
    if (!importCase) return notFoundResponse("Import case not found");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = bulkReviewSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error);

    try {
      const result = await handler(
        caseId,
        tenantId,
        user.id,
        parsed.data.action,
        {
          reason: parsed.data.reason ?? null,
          overrideHsCode: parsed.data.overrideHsCode ?? null,
        },
      );

      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Bulk review action failed",
        },
        { status: 400 },
      );
    }
  };
}
