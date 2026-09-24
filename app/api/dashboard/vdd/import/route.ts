import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { vddCustomFields, vddImportBatches } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/require-admin";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { validationErrorResponse } from "@/lib/import-cases/api-helpers";
import {
  parseVddWorkbookBuffer,
  serializeInvalidRowsForReport,
} from "@/lib/vdd/import-vdd-xlsx";
import { type VddColumnMappings, VDD_FIELD_KEYS } from "@/lib/vdd/column-map";
import { vddImportOptionsSchema } from "@/lib/vdd/validation";
import { upsertVddParsedRecords } from "@/lib/vdd/upsert-records";

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

function parseCustomFieldMappings(
  raw: FormDataEntryValue | null,
): Record<string, string> | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (typeof value === "string" && value.trim()) {
        result[key] = value.trim();
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
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

  const customFields = await db
    .select({
      fieldKey: vddCustomFields.fieldKey,
      label: vddCustomFields.label,
    })
    .from(vddCustomFields)
    .where(eq(vddCustomFields.tenantId, tenantId))
    .orderBy(asc(vddCustomFields.createdAt));

  const parsed = parseVddWorkbookBuffer(buffer, {
    sheetName: optionsParsed.data.sheetName,
    columnMappings: optionsParsed.data.columnMappings,
    customFieldMappings: parseCustomFieldMappings(
      form.get("customFieldMappings"),
    ),
    customFields,
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
      columnMappings: {
        ...parsed.effectiveMappings,
        __custom: parsed.customFieldMappings,
      },
      extraColumns: [
        ...parsed.extraHeaders,
        ...Object.keys(parsed.customFieldMappings),
      ],
      errorReport: null,
    })
    .returning();

  try {
    const upsertStats = await upsertVddParsedRecords({
      tenantId,
      batchId: batch.id,
      sourceFileName: file.name,
      records: parsed.validRows,
    });

    await db
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
          customFieldMappings: parsed.customFieldMappings,
          upsert: upsertStats,
        },
      })
      .where(eq(vddImportBatches.id, batch.id));

    return NextResponse.json({
      ok: true,
      batchId: batch.id,
      fileName: file.name,
      sheetName: parsed.sheetName,
      totalRows: parsed.totalDataRows,
      validRows: parsed.validRows.length,
      invalidRows: parsed.invalidRows.length,
      inserted: upsertStats.inserted,
      updated: upsertStats.updated,
      skippedDuplicates: upsertStats.skipped,
      qualityFlaggedCount: parsed.validRows.filter(
        (r) => r.dataQualityFlags.length > 0,
      ).length,
      extraHeaders: parsed.extraHeaders,
      extraColumnCount: parsed.extraHeaders.length,
      customFieldMappings: parsed.customFieldMappings,
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
