import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/session";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { isStaffRole } from "@/lib/auth/roles";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/import-cases/api-helpers";
import {
  analyzeColumns,
  cellText,
  getFieldDefs,
  headerSignature,
  mappingFromAnalysis,
  savedToMapping,
  validateMapping,
  type ColumnMapping,
} from "@/lib/import-cases/column-mapping";
import { getSavedColumnMapping } from "@/lib/import-cases/column-mapping-store";
import { processImportDocument } from "@/lib/import-cases/process-import-document";
import { mappingKindForDocumentType } from "@/lib/import-cases/spreadsheet-plan";
import { readSpreadsheetTable } from "@/lib/import-cases/spreadsheet-reader";
import {
  getCaseDocument,
  getImportCaseById,
  getTenantId,
} from "@/lib/import-cases/queries";
import { downloadObject } from "@/lib/storage/r2";

type RouteParams = {
  params: Promise<{ caseId: string; documentId: string }>;
};

const PREVIEW_ROWS = 8;
const SPREADSHEET_EXTENSIONS = new Set(["xlsx", "xls", "csv"]);

const applySchema = z.object({
  sheetName: z.string().min(1).max(200).optional(),
  headerRow: z.number().int().min(1).max(200).optional(),
  /** field key -> source column index (null = not mapped) */
  mapping: z.record(z.string(), z.number().int().min(0).max(500).nullable()),
  /** source column index -> what to do with a column that is not mapped */
  extraColumns: z
    .record(z.string(), z.enum(["extra", "ignore"]))
    .optional(),
  /** remember this mapping for files with the same column headers */
  remember: z.boolean().optional(),
  /** "ai" skips the mapper and extracts with AI instead */
  mode: z.enum(["mapping", "ai"]).default("mapping"),
});

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

async function authorize(params: RouteParams["params"]) {
  const user = await getAuthUser();
  if (!user?.id) return { error: unauthorizedResponse() } as const;
  const session = await getSessionUserProfile();
  if (!isStaffRole(session?.profile?.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  }
  const { caseId, documentId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return { error: notFoundResponse("Import case not found") } as const;
  const document = await getCaseDocument(caseId, documentId);
  if (!document) return { error: notFoundResponse("Document not found") } as const;
  return { user, caseId, documentId, tenantId, document } as const;
}

function spreadsheetKind(document: { documentType: string; originalFileName: string }) {
  const kind = mappingKindForDocumentType(document.documentType);
  const ext = document.originalFileName.split(".").pop()?.toLowerCase() ?? "";
  if (!kind || !SPREADSHEET_EXTENSIONS.has(ext)) return null;
  return kind;
}

/** GET: preview rows + suggested mapping for the "Map columns" dialog. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authorize(params);
  if ("error" in auth) return auth.error;
  const { document, tenantId } = auth;

  const kind = spreadsheetKind(document);
  if (!kind) {
    return NextResponse.json(
      {
        error:
          "Column mapping is only available for invoice and packing list files in Excel or CSV format.",
      },
      { status: 400 },
    );
  }

  const sp = request.nextUrl.searchParams;
  const headerRowParam = sp.get("headerRow");
  const headerRow = headerRowParam ? Number.parseInt(headerRowParam, 10) : undefined;
  if (headerRowParam && (!Number.isInteger(headerRow) || (headerRow ?? 0) < 1)) {
    return NextResponse.json({ error: "Invalid header row" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = await downloadObject(document.storageKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `The uploaded file could not be loaded: ${message}` },
      { status: 500 },
    );
  }

  const read = readSpreadsheetTable(buffer, {
    kind,
    sheetName: sp.get("sheet") ?? undefined,
    headerRow,
  });
  if (!read.table || read.error) {
    return NextResponse.json(
      { error: read.error ?? "The spreadsheet could not be read.", sheets: read.sheets },
      { status: 422 },
    );
  }
  const table = read.table;
  const analysis = analyzeColumns({ kind, headers: table.headers, rows: table.rows });
  const signature = headerSignature(table.headers);

  // initial mapping: what this document was imported with > saved > suggestion
  let initial: ColumnMapping = mappingFromAnalysis(analysis, table.headers);
  let initialSource: "current" | "saved" | "suggested" = "suggested";
  const stored = isRecord(document.extractedData)
    ? document.extractedData.columnMapping
    : null;
  if (
    isRecord(stored) &&
    stored.signature === signature &&
    isRecord(stored.fields) &&
    validateMapping(kind, { fields: stored.fields as ColumnMapping["fields"] }, table.headers.length).length === 0
  ) {
    initial = {
      fields: stored.fields as ColumnMapping["fields"],
      extraColumns: isRecord(stored.extraColumns)
        ? (stored.extraColumns as ColumnMapping["extraColumns"])
        : {},
    };
    initialSource = "current";
  } else {
    const saved = await getSavedColumnMapping(tenantId, kind, signature).catch(() => null);
    const restored = saved ? savedToMapping(saved, table.headers) : null;
    if (restored && validateMapping(kind, restored, table.headers.length).length === 0) {
      initial = restored;
      initialSource = "saved";
    }
  }

  return NextResponse.json({
    documentId: document.id,
    documentType: document.documentType,
    kind,
    fileName: document.originalFileName,
    sheets: read.sheets,
    sheetName: table.sheetName,
    headerRow: table.headerRowNumber,
    totalRows: table.rows.length,
    headers: table.headers.map((label, index) => ({ index, label })),
    previewRows: table.rows
      .slice(0, PREVIEW_ROWS)
      .map((row) => row.map((c) => cellText(c))),
    fields: getFieldDefs(kind).map((f) => ({
      key: f.key,
      label: f.label,
      required: !!f.required,
      requiredGroup: f.requiredGroup ?? null,
      storage: f.storage,
    })),
    suggestions: analysis.suggestions,
    sure: analysis.sure,
    reasons: analysis.reasons,
    warnings: analysis.warnings,
    unmappedColumns: analysis.unmappedColumns,
    initialMapping: initial,
    initialSource,
  });
}

/** POST: apply a confirmed mapping (or AI extraction) and import the lines. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await authorize(params);
  if ("error" in auth) return auth.error;
  const { document, caseId, documentId, tenantId, user } = auth;

  const kind = spreadsheetKind(document);
  if (!kind) {
    return NextResponse.json(
      { error: "Column mapping is only available for invoice and packing list spreadsheets." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = applySchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  if (parsed.data.mode === "ai") {
    const extraction = await processImportDocument(caseId, documentId, tenantId, user.id, {
      forceAi: true,
    });
    return NextResponse.json({ extraction }, { status: extraction.error ? 422 : 200 });
  }

  const knownKeys = new Set(getFieldDefs(kind).map((f) => f.key));
  const unknown = Object.keys(parsed.data.mapping).filter((k) => !knownKeys.has(k));
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: `Unknown field(s): ${unknown.join(", ")}` },
      { status: 400 },
    );
  }

  const mapping: ColumnMapping = {
    fields: parsed.data.mapping,
    extraColumns: parsed.data.extraColumns ?? {},
  };
  const extraction = await processImportDocument(caseId, documentId, tenantId, user.id, {
    columnMapping: {
      sheetName: parsed.data.sheetName,
      headerRow: parsed.data.headerRow,
      mapping,
      remember: parsed.data.remember ?? false,
    },
  });

  if (extraction.error) {
    return NextResponse.json({ error: extraction.error, extraction }, { status: 422 });
  }
  return NextResponse.json({ extraction });
}
