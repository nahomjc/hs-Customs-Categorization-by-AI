import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/import-cases/api-helpers";
import { approveProductClassification } from "@/lib/import-cases/approve-classification";
import { getImportCaseById, getTenantId } from "@/lib/import-cases/queries";
import { approveClassificationSchema } from "@/lib/import-cases/validation";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = approveClassificationSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const result = await approveProductClassification(
      caseId,
      productId,
      tenantId,
      user.id,
      parsed.data,
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
