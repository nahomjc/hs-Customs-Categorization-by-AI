import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/import-cases/api-helpers";
import { getCaseClassifications } from "@/lib/import-cases/classification-queries";
import { isHsReferenceAvailable } from "@/lib/import-cases/classify-product-description";
import { getImportCaseById, getTenantId } from "@/lib/import-cases/queries";

type RouteParams = { params: Promise<{ caseId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  const [classifications, referencePopulated] = await Promise.all([
    getCaseClassifications(caseId),
    isHsReferenceAvailable(),
  ]);
  return NextResponse.json({ classifications, referencePopulated });
}
