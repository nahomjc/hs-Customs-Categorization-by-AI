import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/import-cases/api-helpers";
import { getImportCaseById, getTenantId } from "@/lib/import-cases/queries";
import { getCaseStepSummary } from "@/lib/import-cases/step-summary-queries";

type RouteParams = { params: Promise<{ caseId: string }> };

/** Fresh counts for the wizard's Continue check (no caching, same auth as the other case routes). */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  const summary = await getCaseStepSummary(caseId);
  return NextResponse.json(summary, {
    headers: { "Cache-Control": "no-store" },
  });
}