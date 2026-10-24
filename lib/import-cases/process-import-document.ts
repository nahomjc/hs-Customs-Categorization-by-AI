import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  importCaseDocuments,
  importCases,
  invoiceLines,
  packingListLines,
} from "@/db/schema";
import type { DocumentType } from "./constants";
import {
  INVOICE_DOCUMENT_TYPES,
  PACKING_LIST_DOCUMENT_TYPES,
} from "./constants";
import {
  extractDocumentData,
  type ExtractDocumentOutput,
} from "./extract-document-data";
import { mappingToSaved } from "./column-mapping";
import { saveColumnMapping } from "./column-mapping-store";
import {
  mappingKindForDocumentType,
  planSpreadsheetExtraction,
  type ColumnMappingRequest,
} from "./spreadsheet-plan";
import {
  SpreadsheetImportError,
  type ImportIssue,
} from "./spreadsheet-import";
import type {
  InvoiceExtractResult,
  PackingListExtractResult,
} from "./extraction-schemas";
import { extractTextFromBuffer, type FileType } from "@/lib/extractText";
import { downloadObject } from "@/lib/storage/r2";
import { runImportCaseChecks } from "./run-case-checks";
import { writeAuditLog } from "./queries";

export type ProcessImportOptions = {
  /** Column mapping confirmed by the user (spreadsheets only). */
  columnMapping?: ColumnMappingRequest;
  /** Skip the spreadsheet mapper and use AI extraction. */
  forceAi?: boolean;
};

export type ProcessImportDocumentResult = {
  documentId: string;
  extractionStatus: string;
  lineCount: number;
  confidence: number;
  error?: string;
  /** Spreadsheet needs the user to confirm the column mapping. */
  needsMapping?: boolean;
  /** Why the mapping needs confirmation. */
  reasons?: string[];
  warnings?: string[];
  issues?: ImportIssue[];
  mappingSource?: "auto" | "saved" | "user";
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function extToFileType(ext: string): FileType | null {
  const map: Record<string, FileType> = {
    pdf: "pdf",
    docx: "docx",
    xlsx: "xlsx",
    xls: "xlsx",
    csv: "csv",
  };
  return map[ext.toLowerCase()] ?? null;
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function processImportDocument(
  caseId: string,
  documentId: string,
  tenantId: string,
  userId?: string | null,
  options: ProcessImportOptions = {},
): Promise<ProcessImportDocumentResult> {
  const [doc] = await db
    .select()
    .from(importCaseDocuments)
    .where(
      and(
        eq(importCaseDocuments.id, documentId),
        eq(importCaseDocuments.importCaseId, caseId),
      ),
    )
    .limit(1);

  if (!doc) {
    throw new Error("Document not found");
  }

  await db
    .update(importCaseDocuments)
    .set({
      extractionStatus: "processing",
      status: "processing",
      updatedAt: new Date(),
    })
    .where(eq(importCaseDocuments.id, documentId));

  await db
    .update(importCases)
    .set({ status: "extraction_in_progress", updatedAt: new Date() })
    .where(eq(importCases.id, caseId));

  let importIssues: ImportIssue[] = [];

  try {
    const ext =
      doc.originalFileName.split(".").pop()?.toLowerCase() ??
      doc.storageKey.split(".").pop()?.toLowerCase() ??
      "bin";
    const fileType = extToFileType(ext);
    if (!fileType) {
      throw new Error(`Unsupported file extension: .${ext}`);
    }

    const buffer = await downloadObject(doc.storageKey);
    const ocrText = await extractTextFromBuffer(buffer, fileType);

    if (!ocrText.trim()) {
      throw new Error("No text could be extracted from this document");
    }

    let extraction: ExtractDocumentOutput | null = null;
    let columnMappingInfo: Record<string, unknown> | null = null;
    let mappingSource: "auto" | "saved" | "user" | undefined;
    let mappingWarnings: string[] = [];
    let planForSave: {
      kind: "invoice" | "packing_list";
      signature: string;
      headers: string[];
      mapping: Parameters<typeof mappingToSaved>[0];
    } | null = null;

    const mappingKind = mappingKindForDocumentType(doc.documentType);
    const isSpreadsheet = fileType === "xlsx" || fileType === "csv";
    if (mappingKind && isSpreadsheet && !options.forceAi) {
      const plan = await planSpreadsheetExtraction({
        buffer,
        kind: mappingKind,
        tenantId,
        request: options.columnMapping,
      });

      if (plan.status === "needs_mapping") {
        const reasons = plan.analysis.reasons;
        await db
          .update(importCaseDocuments)
          .set({
            extractionStatus: "needs_mapping",
            status: "needs_review",
            extractedData: {
              ...asRecord(doc.extractedData),
              columnMapping: {
                needsMapping: true,
                reasons,
                sheetName: plan.table.sheetName,
                headerRow: plan.table.headerRowNumber,
                signature: plan.signature,
              },
            },
            updatedAt: new Date(),
          })
          .where(eq(importCaseDocuments.id, documentId));
        await db
          .update(importCases)
          .set({ status: "documents_uploaded", updatedAt: new Date() })
          .where(eq(importCases.id, caseId));
        await writeAuditLog({
          tenantId,
          importCaseId: caseId,
          userId: userId ?? null,
          entityType: "import_case_document",
          entityId: documentId,
          action: "document_needs_column_mapping",
          newData: { reasons },
        });
        return {
          documentId,
          extractionStatus: "needs_mapping",
          lineCount: 0,
          confidence: 0,
          needsMapping: true,
          reasons,
        };
      }

      if (plan.status === "ready") {
        extraction = plan.extraction;
        mappingSource = plan.source;
        importIssues = plan.report.issues;
        mappingWarnings = [...plan.report.warnings, ...plan.analysis.warnings];
        mappingWarnings = Array.from(new Set(mappingWarnings));
        columnMappingInfo = {
          source: plan.source,
          sheetName: plan.table.sheetName,
          headerRow: plan.table.headerRowNumber,
          signature: plan.signature,
          headers: plan.table.headers,
          fields: plan.mapping.fields,
          extraColumns: plan.mapping.extraColumns ?? {},
          keptAsExtra: plan.report.extraColumns,
          rowsRead: plan.report.rowsRead,
          rowsImported: plan.report.rowsImported,
          rowsSkipped: plan.report.rowsSkipped,
          warnings: mappingWarnings,
          issues: plan.report.issues,
        };
        planForSave = {
          kind: plan.kind,
          signature: plan.signature,
          headers: plan.table.headers,
          mapping: plan.mapping,
        };
      } else if (options.columnMapping) {
        // The user confirmed a mapping but the sheet could not be read the same way.
        throw new Error(plan.error);
      } else {
        console.warn(
          "[import-cases] spreadsheet mapper skipped, falling back to AI:",
          plan.error,
        );
      }
    }

    if (!extraction) {
      extraction = await extractDocumentData({
        documentType: doc.documentType as DocumentType,
        ocrText,
        fileName: doc.originalFileName,
      });
    }

    const extractedData = {
      ocrText,
      extraction,
      extractedAt: new Date().toISOString(),
      ...(columnMappingInfo ? { columnMapping: columnMappingInfo } : {}),
    };

    let lineCount = 0;

    await db.transaction(async (tx) => {
      if (extraction.kind === "invoice") {
        const data = extraction.data as InvoiceExtractResult;
        await tx
          .delete(invoiceLines)
          .where(eq(invoiceLines.documentId, documentId));

        const currency = data.currencyCode ?? "USD";
        const values = data.lines.map((line, idx) => ({
          importCaseId: caseId,
          documentId,
          lineNumber: line.lineNumber ?? idx + 1,
          supplierDescription: line.supplierDescription,
          supplierSku: line.supplierSku ?? null,
          brand: line.brand ?? null,
          modelNumber: line.modelNumber ?? null,
          quantity: line.quantity,
          unitOfMeasure: line.unitOfMeasure,
          unitPrice: line.unitPrice ?? null,
          lineTotalAmount: line.lineTotalAmount ?? null,
          currencyCode: line.currencyCode ?? currency,
          countryOfOriginCode:
            line.countryOfOriginCode ?? data.countryOfOriginCode ?? null,
          declaredNetWeightKg: line.declaredNetWeightKg ?? null,
          declaredGrossWeightKg: line.declaredGrossWeightKg ?? null,
          extra: line.extra ?? null,
          extractionConfidence: String(extraction.confidence),
        }));

        if (values.length > 0) {
          await tx.insert(invoiceLines).values(values);
        }
        lineCount = values.length;

        await tx
          .update(importCaseDocuments)
          .set({
            extractedData,
            extractionStatus: "completed",
            extractionConfidence: String(extraction.confidence),
            status:
              extraction.confidence < 0.6 ? "needs_review" : "extracted",
            documentNumber: data.documentNumber ?? doc.documentNumber,
            documentDate:
              parseOptionalDate(data.documentDate) ?? doc.documentDate,
            updatedAt: new Date(),
          })
          .where(eq(importCaseDocuments.id, documentId));

        if (data.invoiceTotalAmount || data.supplierName) {
          const caseUpdate: Record<string, unknown> = { updatedAt: new Date() };
          if (data.invoiceTotalAmount) {
            caseUpdate.invoiceTotalAmount = data.invoiceTotalAmount;
          }
          if (data.currencyCode) {
            caseUpdate.invoiceCurrencyCode = data.currencyCode;
          }
          if (data.incoterm) caseUpdate.incoterm = data.incoterm;
          if (data.supplierName) caseUpdate.supplierName = data.supplierName;
          if (data.countryOfOriginCode) {
            caseUpdate.countryOfOriginCode = data.countryOfOriginCode;
          }
          await tx
            .update(importCases)
            .set(caseUpdate)
            .where(eq(importCases.id, caseId));
        }
      } else if (extraction.kind === "packing_list") {
        const data = extraction.data as PackingListExtractResult;
        await tx
          .delete(packingListLines)
          .where(eq(packingListLines.documentId, documentId));

        const values = data.lines.map((line, idx) => ({
          importCaseId: caseId,
          documentId,
          lineNumber: line.lineNumber ?? idx + 1,
          supplierDescription: line.supplierDescription,
          supplierSku: line.supplierSku ?? null,
          brand: line.brand ?? null,
          modelNumber: line.modelNumber ?? null,
          quantity: line.quantity,
          unitOfMeasure: line.unitOfMeasure,
          packageType: line.packageType ?? null,
          numberOfPackages: line.numberOfPackages ?? null,
          piecesPerPackage: line.piecesPerPackage ?? null,
          netWeightKg: line.netWeightKg ?? null,
          grossWeightKg: line.grossWeightKg ?? null,
          packageMarks: line.packageMarks ?? null,
          countryOfOriginCode: line.countryOfOriginCode ?? null,
          extra: line.extra ?? null,
          extractionConfidence: String(extraction.confidence),
        }));

        if (values.length > 0) {
          await tx.insert(packingListLines).values(values);
        }
        lineCount = values.length;

        await tx
          .update(importCaseDocuments)
          .set({
            extractedData,
            extractionStatus: "completed",
            extractionConfidence: String(extraction.confidence),
            status:
              extraction.confidence < 0.6 ? "needs_review" : "extracted",
            documentNumber: data.documentNumber ?? doc.documentNumber,
            relatedInvoiceNumber:
              data.relatedInvoiceNumber ?? doc.relatedInvoiceNumber,
            documentDate:
              parseOptionalDate(data.documentDate) ?? doc.documentDate,
            updatedAt: new Date(),
          })
          .where(eq(importCaseDocuments.id, documentId));

        if (data.shipmentReference) {
          await tx
            .update(importCases)
            .set({
              shipmentReference: data.shipmentReference,
              updatedAt: new Date(),
            })
            .where(eq(importCases.id, caseId));
        }
      } else {
        await tx
          .update(importCaseDocuments)
          .set({
            extractedData,
            extractionStatus: "completed",
            extractionConfidence: "0",
            status: "extracted",
            updatedAt: new Date(),
          })
          .where(eq(importCaseDocuments.id, documentId));
      }
    });

    const hasInvoiceOrPacking =
      INVOICE_DOCUMENT_TYPES.has(doc.documentType) ||
      PACKING_LIST_DOCUMENT_TYPES.has(doc.documentType);

    if (hasInvoiceOrPacking && lineCount === 0) {
      await db
        .update(importCaseDocuments)
        .set({
          extractionStatus: "failed",
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(importCaseDocuments.id, documentId));
      throw new Error("No product lines could be extracted");
    }

    if (options.columnMapping?.remember && planForSave && mappingSource === "user") {
      try {
        await saveColumnMapping({
          tenantId,
          kind: planForSave.kind,
          headerSignature: planForSave.signature,
          headers: planForSave.headers,
          mapping: mappingToSaved(planForSave.mapping, planForSave.headers),
          supplierName:
            extraction.kind === "invoice" || extraction.kind === "packing_list"
              ? ((extraction.data as { supplierName?: string | null }).supplierName ??
                null)
              : null,
          userId: userId ?? null,
        });
      } catch (saveError) {
        console.error("[import-cases] could not save column mapping", saveError);
      }
    }

    await runImportCaseChecks(caseId);

    await db
      .update(importCases)
      .set({ status: "documents_uploaded", updatedAt: new Date() })
      .where(eq(importCases.id, caseId));

    await writeAuditLog({
      tenantId,
      importCaseId: caseId,
      userId: userId ?? null,
      entityType: "import_case_document",
      entityId: documentId,
      action: "document_extracted",
      newData: {
        lineCount,
        confidence: extraction.confidence,
        kind: extraction.kind,
        ...(mappingSource ? { mappingSource } : {}),
      },
    });

    return {
      documentId,
      extractionStatus: "completed",
      lineCount,
      confidence: extraction.confidence,
      ...(mappingSource ? { mappingSource } : {}),
      ...(mappingWarnings.length ? { warnings: mappingWarnings } : {}),
      ...(importIssues.length ? { issues: importIssues } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedIssues =
      error instanceof SpreadsheetImportError ? error.issues : importIssues;
    await db
      .update(importCaseDocuments)
      .set({
        extractionStatus: "failed",
        status: "failed",
        // keep the reason so the UI can show it next to the document
        extractedData: {
          ...asRecord(doc.extractedData),
          extractionError: message,
          extractionIssues: failedIssues,
          failedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(importCaseDocuments.id, documentId));

    await writeAuditLog({
      tenantId,
      importCaseId: caseId,
      userId: userId ?? null,
      entityType: "import_case_document",
      entityId: documentId,
      action: "document_extraction_failed",
      newData: { error: message },
    });

    return {
      documentId,
      extractionStatus: "failed",
      lineCount: 0,
      confidence: 0,
      error: message,
      ...(failedIssues.length ? { issues: failedIssues } : {}),
    };
  }
}
