import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vddImportBatches, vddReferenceRecords } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/require-admin";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { validationErrorResponse } from "@/lib/import-cases/api-helpers";
import {
  parseVddWorkbookBuffer,
  serializeInvalidRowsForReport,
  type VddParsedRecord,
} from "@/lib/vdd/import-vdd-xlsx";
import { type VddColumnMappings, VDD_FIELD_KEYS } from "@/lib/vdd/column-map";
import { vddImportOptionsSchema } from "@/lib/vdd/validation";

export const runtime = "nodejs";

function parseColumnMappings(
  raw: FormDataEntryValue | null,
): VddColumnMappings | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    const result: VddColumnMappings = {};
    for (const key of VDD_FIELD_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return undefined;
  }
}

function toInsertRows(
  records: VddParsedRecord[],
  opts: {
    tenantId: string;
    batchId: string;
    sourceFileName: string;
  },
) {
  return records.map((r) => ({
    tenantId: opts.tenantId,
    importBatchId: opts.batchId,
    sourceFileName: opts.sourceFileName,
    sourceRowNumber: r.sourceRowNumber,
    importerName: r.importerName,
    declarationNumber: r.declarationNumber,
    hsCode: r.hsCode,
    unitOfQuantity: r.unitOfQuantity,
    originCode: r.originCode,
    countryName: r.countryName,
    brandOrMake: r.brandOrMake,
    model: r.model,
    commonName: r.commonName,
    condition: r.condition,
    commercialDescription: r.commercialDescription,
    appearance: r.appearance,
    material: r.material,
    size: r.size,
    productType: r.productType,
    diameter: r.diameter,
    width: r.width,
    length: r.length,
    declaredUnitPrice: r.declaredUnitPrice,
    netMass: r.netMass,
    grossMass: r.grossMass,
    currencyCode: r.currencyCode,
    normalizedText: r.normalizedText,
    normalizedData: r.normalizedData,
    rawRow: r.rawRow,
    extraAttributes: r.extraAttributes,
    dataQualityFlags: r.dataQualityFlags,
  }));
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const tenantId = admin.session.profile.tenantId ?? DEFAULT_TENANT_ID;
  const userId = admin.session.profile.id;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    return NextResponse.json(
      { error: "Please upload an Excel file (.xlsx or .xls)" },
      { status: 400 },
    );
  }

  const optionsParsed = vddImportOptionsSchema.safeParse({
    sheetName: form.get("sheetName") || undefined,
    columnMappings: parseColumnMappings(form.get("columnMappings")),
  });
  if (!optionsParsed.success) {
    return validationErrorResponse(optionsParsed.error);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  const parsed = parseVddWorkbookBuffer(buffer, {
    sheetName: optionsParsed.data.sheetName,
    columnMappings: optionsParsed.data.columnMappings,
  });

  if (!parsed.sheetName) {
    return NextResponse.json(
      { error: "Workbook has no sheets" },
      { status: 400 },
    );
  }

  if (parsed.validRows.length === 0) {
    return NextResponse.json(
      {
        error: "No valid VDD rows found. Check column mappings and HS codes.",
        invalidRowCount: parsed.invalidRows.length,
        invalidSample: serializeInvalidRowsForReport(parsed.invalidRows, 20),
      },
      { status: 400 },
    );
  }

  const [batch] = await db
    .insert(vddImportBatches)
    .values({
      tenantId,
      sourceFileName: file.name,
      sourceFileHash: fileHash,
      sourceType: "xlsx",
      sheetName: parsed.sheetName,
      rowCount: parsed.totalDataRows,
      validRowCount: parsed.validRows.length,
      invalidRowCount: parsed.invalidRows.length,
      status: "processing",
      importedByUserId: userId,
      columnMappings: parsed.effectiveMappings,
      extraColumns: parsed.extraHeaders,
      errorReport: null,
    })
    .returning();

  try {
    const chunkSize = 200;
    const inserts = toInsertRows(parsed.validRows, {
      tenantId,
      batchId: batch.id,
      sourceFileName: file.name,
    });

    await db.transaction(async (tx) => {
      for (let i = 0; i < inserts.length; i += chunkSize) {
        const chunk = inserts.slice(i, i + chunkSize);
        await tx.insert(vddReferenceRecords).values(chunk);
      }

      await tx
        .update(vddImportBatches)
        .set({
          status: "completed",
          completedAt: new Date(),
          errorReport: {
            invalidRows: serializeInvalidRowsForReport(parsed.invalidRows),
            invalidRowCount: parsed.invalidRows.length,
            qualityFlaggedCount: parsed.validRows.filter(
              (r) => r.dataQualityFlags.length > 0,
            ).length,
            extraColumnCount: parsed.extraHeaders.length,
            extraColumns: parsed.extraHeaders,
          },
        })
        .where(eq(vddImportBatches.id, batch.id));
    });

    return NextResponse.json({
      ok: true,
      batchId: batch.id,
      fileName: file.name,
      sheetName: parsed.sheetName,
      totalRows: parsed.totalDataRows,
      validRows: parsed.validRows.length,
      invalidRows: parsed.invalidRows.length,
      qualityFlaggedCount: parsed.validRows.filter(
        (r) => r.dataQualityFlags.length > 0,
      ).length,
      extraHeaders: parsed.extraHeaders,
      extraColumnCount: parsed.extraHeaders.length,
      disclaimer:
        "VDD references support review only. They do not determine the final HS code or customs value.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    await db
      .update(vddImportBatches)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorReport: { message },
      })
      .where(eq(vddImportBatches.id, batch.id));

    return NextResponse.json(
      { error: message, batchId: batch.id },
      { status: 500 },
    );
  }
}
