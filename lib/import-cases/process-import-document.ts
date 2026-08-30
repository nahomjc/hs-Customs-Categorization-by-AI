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
import { extractDocumentData } from "./extract-document-data";
import type {
  InvoiceExtractResult,
  PackingListExtractResult,
} from "./extraction-schemas";
import { extractTextFromBuffer, type FileType } from "@/lib/extractText";
import { downloadObject } from "@/lib/storage/r2";
import { runImportCaseChecks } from "./run-case-checks";
import { writeAuditLog } from "./queries";

export type ProcessImportDocumentResult = {
  documentId: string;
  extractionStatus: string;
  lineCount: number;
  confidence: number;
  error?: string;
};

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

    const extraction = await extractDocumentData({
      documentType: doc.documentType as DocumentType,
      ocrText,
      fileName: doc.originalFileName,
    });

    const extractedData = {
      ocrText,
      extraction,
      extractedAt: new Date().toISOString(),
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
      },
    });

    return {
      documentId,
      extractionStatus: "completed",
      lineCount,
      confidence: extraction.confidence,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(importCaseDocuments)
      .set({
        extractionStatus: "failed",
        status: "failed",
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
    };
  }
}
