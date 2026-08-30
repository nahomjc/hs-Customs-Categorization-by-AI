import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/import-cases/api-helpers";
import { classifySingleImportProduct } from "@/lib/import-cases/classify-products";
import { getImportCaseById, getTenantId } from "@/lib/import-cases/queries";

type RouteParams = {
  params: Promise<{ caseId: string; productId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId, productId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  let forceAi = true;
  try {
    const body = (await request.json()) as { forceAi?: boolean };
    if (body.forceAi === false) forceAi = false;
  } catch {
    // default: force AI when user explicitly asks
  }

  try {
    const result = await classifySingleImportProduct(
      caseId,
      tenantId,
      productId,
      user.id,
      { forceAi },
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
