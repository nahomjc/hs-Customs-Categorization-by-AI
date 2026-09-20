import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/import-cases/api-helpers";
import { getImportCaseById, getTenantId } from "@/lib/import-cases/queries";
import {
  getCaseChecks,
  runImportCaseChecks,
} from "@/lib/import-cases/run-case-checks";

type RouteParams = { params: Promise<{ caseId: string }> };

/**
 * Returns current checks. By default recomputes open auto-checks from the
 * latest invoice/packing lines so corrected quantities clear stale errors.
 * Pass ?refresh=0 to skip recomputation.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  const skipRefresh =
    request.nextUrl.searchParams.get("refresh") === "0";
  if (!skipRefresh) {
    await runImportCaseChecks(caseId);
  }

  const checks = await getCaseChecks(caseId);
  return NextResponse.json({ checks });
}
