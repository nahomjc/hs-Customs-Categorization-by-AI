import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { importCases } from "@/db/schema";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/import-cases/api-helpers";
import {
  getImportCaseById,
  getTenantId,
  writeAuditLog,
} from "@/lib/import-cases/queries";
import { updateImportCaseSchema } from "@/lib/import-cases/validation";

type RouteParams = { params: Promise<{ caseId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  return NextResponse.json(importCase);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId } = await params;
  const tenantId = getTenantId();
  const existing = await getImportCaseById(caseId, tenantId);
  if (!existing) return notFoundResponse("Import case not found");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateImportCaseSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const [updated] = await db
    .update(importCases)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(importCases.id, caseId))
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Failed to update import case" },
      { status: 500 },
    );
  }

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId: user.id,
    entityType: "import_case",
    entityId: caseId,
    action: "import_case_updated",
    oldData: existing as unknown as Record<string, unknown>,
    newData: updated as unknown as Record<string, unknown>,
  });

  return NextResponse.json(updated);
}
