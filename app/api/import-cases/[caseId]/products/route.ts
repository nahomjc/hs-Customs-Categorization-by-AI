import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/import-cases/api-helpers";
import { getCaseProducts } from "@/lib/import-cases/product-queries";
import { getImportCaseById, getTenantId } from "@/lib/import-cases/queries";

type RouteParams = { params: Promise<{ caseId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  const products = await getCaseProducts(caseId);
  return NextResponse.json({ products });
}
