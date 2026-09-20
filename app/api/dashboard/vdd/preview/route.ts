import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { validationErrorResponse } from "@/lib/import-cases/api-helpers";
import { parseVddWorkbookBuffer } from "@/lib/vdd/import-vdd-xlsx";
import {
  type VddColumnMappings,
  VDD_FIELD_KEYS,
  VDD_FIELD_LABELS,
} from "@/lib/vdd/column-map";
import { vddPreviewOptionsSchema } from "@/lib/vdd/validation";

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

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

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

  const optionsParsed = vddPreviewOptionsSchema.safeParse({
    sheetName: form.get("sheetName") || undefined,
    columnMappings: parseColumnMappings(form.get("columnMappings")),
    previewLimit: form.get("previewLimit") || undefined,
  });
  if (!optionsParsed.success) {
    return validationErrorResponse(optionsParsed.error);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  const parsed = parseVddWorkbookBuffer(buffer, {
    sheetName: optionsParsed.data.sheetName,
    columnMappings: optionsParsed.data.columnMappings,
    previewLimit: optionsParsed.data.previewLimit ?? 20,
  });

  if (!parsed.sheetName) {
    return NextResponse.json(
      { error: "Workbook has no sheets" },
      { status: 400 },
    );
  }

  const invalidSample = parsed.invalidRows.slice(0, 50).map((r) => ({
    sourceRowNumber: r.sourceRowNumber,
    reasons: r.reasons,
  }));

  const qualityFlagged = parsed.validRows.filter(
    (r) => r.dataQualityFlags.length > 0,
  ).length;

  return NextResponse.json({
    ok: true,
    fileName: file.name,
    fileHash,
    tenantId: admin.session.profile.tenantId ?? DEFAULT_TENANT_ID,
    sheetNames: parsed.sheetNames,
    sheetName: parsed.sheetName,
    headers: parsed.headers,
    detectedMappings: parsed.detectedMappings,
    effectiveMappings: parsed.effectiveMappings,
    fieldKeys: VDD_FIELD_KEYS,
    fieldLabels: VDD_FIELD_LABELS,
    totalDataRows: parsed.totalDataRows,
    validRowCount: parsed.validRows.length,
    invalidRowCount: parsed.invalidRows.length,
    qualityFlaggedCount: qualityFlagged,
    extraHeaders: parsed.extraHeaders,
    extraColumnCount: parsed.extraHeaders.length,
    previewRows: parsed.previewRows,
    invalidSample,
    disclaimer:
      "VDD references support review only. They do not determine the final HS code or customs value.",
  });
}
