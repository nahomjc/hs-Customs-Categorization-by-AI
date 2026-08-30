import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { importCaseDocuments, packingListLines } from "@/db/schema";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/import-cases/api-helpers";
import { PACKING_LIST_DOCUMENT_TYPES } from "@/lib/import-cases/constants";
import {
  getImportCaseById,
  getNextLineNumber,
  getPackingListLines,
  getTenantId,
  writeAuditLog,
} from "@/lib/import-cases/queries";
import { createPackingListLineSchema } from "@/lib/import-cases/validation";

type RouteParams = { params: Promise<{ caseId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  const lines = await getPackingListLines(caseId);
  return NextResponse.json({ lines });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createPackingListLineSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const [document] = await db
    .select()
    .from(importCaseDocuments)
    .where(
      and(
        eq(importCaseDocuments.id, parsed.data.documentId),
        eq(importCaseDocuments.importCaseId, caseId),
      ),
    )
    .limit(1);

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (!PACKING_LIST_DOCUMENT_TYPES.has(document.documentType)) {
    return NextResponse.json(
      { error: "Document is not a packing list type" },
      { status: 400 },
    );
  }

  const lineNumber =
    parsed.data.lineNumber ??
    (await getNextLineNumber(parsed.data.documentId, "packing"));

  const [created] = await db
    .insert(packingListLines)
    .values({
      importCaseId: caseId,
      documentId: parsed.data.documentId,
      lineNumber,
      supplierDescription: parsed.data.supplierDescription,
      supplierSku: parsed.data.supplierSku ?? null,
      brand: parsed.data.brand ?? null,
      modelNumber: parsed.data.modelNumber ?? null,
      quantity: parsed.data.quantity,
      unitOfMeasure: parsed.data.unitOfMeasure,
      packageType: parsed.data.packageType ?? null,
      numberOfPackages: parsed.data.numberOfPackages ?? null,
      piecesPerPackage: parsed.data.piecesPerPackage ?? null,
      netWeightKg: parsed.data.netWeightKg ?? null,
      grossWeightKg: parsed.data.grossWeightKg ?? null,
      lengthCm: parsed.data.lengthCm ?? null,
      widthCm: parsed.data.widthCm ?? null,
      heightCm: parsed.data.heightCm ?? null,
      packageMarks: parsed.data.packageMarks ?? null,
      countryOfOriginCode: parsed.data.countryOfOriginCode ?? null,
    })
    .returning();

  if (!created) {
    return NextResponse.json(
      { error: "Failed to create packing list line" },
      { status: 500 },
    );
  }

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId: user.id,
    entityType: "packing_list_line",
    entityId: created.id,
    action: "packing_line_created",
    newData: { lineNumber: created.lineNumber },
  });

  return NextResponse.json(created, { status: 201 });
}
