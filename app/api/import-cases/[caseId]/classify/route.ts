import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/import-cases/api-helpers";
import { classifyImportCaseProducts } from "@/lib/import-cases/classify-products";
import { getImportCaseById, getTenantId } from "@/lib/import-cases/queries";

type RouteParams = { params: Promise<{ caseId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  let forceAi = false;
  try {
    const body = (await request.json()) as { forceAi?: boolean };
    forceAi = body.forceAi === true;
  } catch {
    // bulk classify defaults to reference-first
  }

  try {
    const result = await classifyImportCaseProducts(caseId, tenantId, user.id, {
      replaceExisting: true,
      forceAi,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
