import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/import-cases/api-helpers";
import { harmonizeImportCase } from "@/lib/import-cases/harmonize-products";
import { getImportCaseById, getTenantId } from "@/lib/import-cases/queries";

type RouteParams = { params: Promise<{ caseId: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  try {
    const result = await harmonizeImportCase(caseId, tenantId, user.id, {
      replaceExisting: true,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
