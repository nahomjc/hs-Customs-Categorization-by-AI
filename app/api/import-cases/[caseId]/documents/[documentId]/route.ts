import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { importCaseDocuments } from "@/db/schema";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/import-cases/api-helpers";
import {
  getCaseDocument,
  getImportCaseById,
  getTenantId,
  writeAuditLog,
} from "@/lib/import-cases/queries";
import { updateDocumentSchema } from "@/lib/import-cases/validation";

type RouteParams = {
  params: Promise<{ caseId: string; documentId: string }>;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId, documentId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  const document = await getCaseDocument(caseId, documentId);
  if (!document) return notFoundResponse("Document not found");

  return NextResponse.json(document);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId, documentId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  const existing = await getCaseDocument(caseId, documentId);
  if (!existing) return notFoundResponse("Document not found");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateDocumentSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (parsed.data.documentNumber !== undefined) {
    updateData.documentNumber = parsed.data.documentNumber;
  }
  if (parsed.data.relatedInvoiceNumber !== undefined) {
    updateData.relatedInvoiceNumber = parsed.data.relatedInvoiceNumber;
  }
  if (parsed.data.documentDate !== undefined) {
    updateData.documentDate = parsed.data.documentDate
      ? new Date(parsed.data.documentDate)
      : null;
  }
  if (parsed.data.reviewDecision) {
    updateData.reviewDecision = parsed.data.reviewDecision;
    updateData.reviewedByUserId = user.id;
    updateData.reviewedAt = new Date();
    updateData.status =
      parsed.data.reviewDecision === "approved" ? "approved" : "rejected";
    if (parsed.data.rejectionReason !== undefined) {
      updateData.rejectionReason = parsed.data.rejectionReason;
    }
  }

  const [updated] = await db
    .update(importCaseDocuments)
    .set(updateData)
    .where(
      and(
        eq(importCaseDocuments.id, documentId),
        eq(importCaseDocuments.importCaseId, caseId),
      ),
    )
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 },
    );
  }

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId: user.id,
    entityType: "import_case_document",
    entityId: documentId,
    action: "document_updated",
    oldData: existing as unknown as Record<string, unknown>,
    newData: updated as unknown as Record<string, unknown>,
  });

  return NextResponse.json(updated);
}
