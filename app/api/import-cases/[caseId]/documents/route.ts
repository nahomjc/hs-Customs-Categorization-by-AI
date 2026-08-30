import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { importCaseDocuments } from "@/db/schema";
import { ensureUserProfile } from "@/lib/auth/ensure-profile";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/import-cases/api-helpers";
import { isDocumentType } from "@/lib/import-cases/constants";
import {
  getCaseDocuments,
  getImportCaseById,
  getTenantId,
  writeAuditLog,
} from "@/lib/import-cases/queries";
import { uploadObject } from "@/lib/storage/r2";
import { processImportDocument } from "@/lib/import-cases/process-import-document";

type RouteParams = { params: Promise<{ caseId: string }> };

const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "xlsx", "xls", "csv", "png", "jpg", "jpeg"]);

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  const documents = await getCaseDocuments(caseId);
  return NextResponse.json({ documents });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id || !user.email) return unauthorizedResponse();

  await ensureUserProfile({
    id: user.id,
    email: user.email,
    fullName: user.name ?? null,
    avatarUrl: user.image ?? null,
  });

  const { caseId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  const form = await request.formData();
  const file = form.get("file");
  const documentTypeRaw = String(form.get("documentType") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!isDocumentType(documentTypeRaw)) {
    return NextResponse.json(
      { error: "Invalid document type" },
      { status: 400 },
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 },
    );
  }

  const docId = uuid();
  const storageKey = `${tenantId}/import-cases/${caseId}/${docId}/file.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await uploadObject(storageKey, buffer, file.type || "application/octet-stream");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const [created] = await db
    .insert(importCaseDocuments)
    .values({
      id: docId,
      importCaseId: caseId,
      uploadedByUserId: user.id,
      documentType: documentTypeRaw,
      status: "uploaded",
      originalFileName: file.name,
      storageKey,
      mimeType: file.type || null,
      fileSizeBytes: file.size,
      extractionStatus: "pending",
    })
    .returning();

  if (!created) {
    return NextResponse.json(
      { error: "Failed to save document record" },
      { status: 500 },
    );
  }

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId: user.id,
    entityType: "import_case_document",
    entityId: created.id,
    action: "document_uploaded",
    newData: {
      documentType: created.documentType,
      originalFileName: created.originalFileName,
    },
  });

  const extraction = await processImportDocument(
    caseId,
    docId,
    tenantId,
    user.id,
  );

  const [updated] = await db
    .select()
    .from(importCaseDocuments)
    .where(eq(importCaseDocuments.id, docId))
    .limit(1);

  return NextResponse.json(
    {
      document: updated ?? created,
      extraction,
    },
    { status: 201 },
  );
}
