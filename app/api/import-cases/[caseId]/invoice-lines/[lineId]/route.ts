import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoiceLines } from "@/db/schema";
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
import { updateInvoiceLineSchema } from "@/lib/import-cases/validation";

type RouteParams = {
  params: Promise<{ caseId: string; lineId: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId, lineId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateInvoiceLineSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      updateData[key] = value;
    }
  }
  if (parsed.data.isReviewed) {
    updateData.reviewedByUserId = user.id;
  }

  const [updated] = await db
    .update(invoiceLines)
    .set(updateData)
    .where(
      and(eq(invoiceLines.id, lineId), eq(invoiceLines.importCaseId, caseId)),
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Invoice line not found" }, { status: 404 });
  }

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId: user.id,
    entityType: "invoice_line",
    entityId: lineId,
    action: "invoice_line_corrected",
    newData: updated as unknown as Record<string, unknown>,
  });

  return NextResponse.json(updated);
}
