/**
 * Decides how a spreadsheet upload is imported:
 *   - mapping confirmed by the user  -> import with it
 *   - saved mapping for this header layout -> import with it (counts as sure)
 *   - suggestion is "sure" -> import automatically
 *   - otherwise -> ask the user to map the columns ("needs_mapping")
 */
import {
  analyzeColumns,
  headerSignature,
  mappingFromAnalysis,
  savedToMapping,
  validateMapping,
  type ColumnMapping,
  type MappingAnalysis,
  type MappingDocKind,
} from "./column-mapping";
import { getSavedColumnMapping } from "./column-mapping-store";
import type { ExtractDocumentOutput } from "./extract-document-data";
import { PROMPT_VERSION } from "./extraction-schemas";
import {
  buildInvoiceFromTable,
  buildPackingListFromTable,
  SpreadsheetImportError,
  type SpreadsheetBuildReport,
} from "./spreadsheet-import";
import { readSpreadsheetTable, type SheetTable } from "./spreadsheet-reader";

export type MappingSource = "auto" | "saved" | "user";

export type ColumnMappingRequest = {
  sheetName?: string;
  headerRow?: number;
  mapping: ColumnMapping;
  remember?: boolean;
};

export type SpreadsheetPlan =
  | {
      status: "ready";
      kind: MappingDocKind;
      table: SheetTable;
      mapping: ColumnMapping;
      source: MappingSource;
      signature: string;
      analysis: MappingAnalysis;
      extraction: ExtractDocumentOutput;
      report: SpreadsheetBuildReport;
    }
  | {
      status: "needs_mapping";
      kind: MappingDocKind;
      table: SheetTable;
      signature: string;
      analysis: MappingAnalysis;
    }
  | { status: "unreadable"; error: string };

export function mappingKindForDocumentType(documentType: string): MappingDocKind | null {
  if (documentType === "commercial_invoice" || documentType === "proforma_invoice") return "invoice";
  if (documentType === "packing_list") return "packing_list";
  return null;
}

export async function planSpreadsheetExtraction(params: {
  buffer: Buffer;
  kind: MappingDocKind;
  tenantId: string;
  request?: ColumnMappingRequest;
}): Promise<SpreadsheetPlan> {
  const { buffer, kind, tenantId, request } = params;
  const read = readSpreadsheetTable(buffer, {
    kind,
    sheetName: request?.sheetName,
    headerRow: request?.headerRow,
  });
  if (!read.table || read.error) {
    return { status: "unreadable", error: read.error ?? "The spreadsheet could not be read." };
  }
  const table = read.table;
  const signature = headerSignature(table.headers);
  const analysis = analyzeColumns({ kind, headers: table.headers, rows: table.rows });

  let mapping: ColumnMapping | null = null;
  let source: MappingSource = "auto";

  if (request?.mapping) {
    const problems = validateMapping(kind, request.mapping, table.headers.length);
    if (problems.length > 0) {
      throw new SpreadsheetImportError(`Column mapping is incomplete: ${problems.join(" ")}`);
    }
    mapping = request.mapping;
    source = "user";
  } else {
    const saved = await getSavedColumnMapping(tenantId, kind, signature).catch(() => null);
    if (saved) {
      const restored = savedToMapping(saved, table.headers);
      if (restored && validateMapping(kind, restored, table.headers.length).length === 0) {
        mapping = restored;
        source = "saved";
      }
    }
    if (!mapping && analysis.sure) {
      mapping = mappingFromAnalysis(analysis, table.headers);
      source = "auto";
    }
  }

  if (!mapping) {
    return { status: "needs_mapping", kind, table, signature, analysis };
  }

  const confidence = source === "auto" ? 0.9 : 0.95;
  const built =
    kind === "invoice"
      ? buildInvoiceFromTable(table, mapping, confidence)
      : buildPackingListFromTable(table, mapping, confidence);

  const extraction: ExtractDocumentOutput = {
    kind,
    data: built.data,
    confidence,
    missingFields: [],
    aiModelName: "spreadsheet-mapper",
    promptVersion: PROMPT_VERSION,
    rawResponse: "",
  };

  return {
    status: "ready",
    kind,
    table,
    mapping,
    source,
    signature,
    analysis,
    extraction,
    report: built.report,
  };
}
