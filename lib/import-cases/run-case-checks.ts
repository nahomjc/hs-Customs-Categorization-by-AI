import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  documentChecks,
  importCaseDocuments,
  invoiceLines,
  packingListLines,
} from "@/db/schema";
import {
  INVOICE_DOCUMENT_TYPES,
  PACKING_LIST_DOCUMENT_TYPES,
} from "./constants";

type CheckInsert = {
  importCaseId: string;
  documentId?: string | null;
  checkType: string;
  severity: "info" | "warning" | "error";
  title: string;
  message: string;
  details?: Record<string, unknown>;
};

function qtyNum(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function runImportCaseChecks(caseId: string): Promise<number> {
  const [invoiceDocs, packingDocs, invLines, packLines] = await Promise.all([
    db
      .select()
      .from(importCaseDocuments)
      .where(eq(importCaseDocuments.importCaseId, caseId)),
    db
      .select()
      .from(importCaseDocuments)
      .where(eq(importCaseDocuments.importCaseId, caseId)),
    db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.importCaseId, caseId)),
    db
      .select()
      .from(packingListLines)
      .where(eq(packingListLines.importCaseId, caseId)),
  ]);

  const invoiceDocuments = invoiceDocs.filter((d) =>
    INVOICE_DOCUMENT_TYPES.has(d.documentType),
  );
  const packingDocuments = packingDocs.filter((d) =>
    PACKING_LIST_DOCUMENT_TYPES.has(d.documentType),
  );

  const checks: CheckInsert[] = [];

  // Invoice number mismatch
  const invoiceNumbers = invoiceDocuments
    .map((d) => d.documentNumber)
    .filter(Boolean) as string[];
  const relatedInvoiceNumbers = packingDocuments
    .map((d) => d.relatedInvoiceNumber)
    .filter(Boolean) as string[];

  if (
    invoiceNumbers.length > 0 &&
    relatedInvoiceNumbers.length > 0 &&
    !relatedInvoiceNumbers.some((r) => invoiceNumbers.includes(r))
  ) {
    checks.push({
      importCaseId: caseId,
      checkType: "invoice_number_mismatch",
      severity: "warning",
      title: "Invoice number does not match packing list",
      message: `Commercial invoice number (${invoiceNumbers.join(", ")}) does not match related invoice on packing list (${relatedInvoiceNumbers.join(", ")}).`,
      details: { invoiceNumbers, relatedInvoiceNumbers },
    });
  }

  // Low confidence extractions
  for (const doc of [...invoiceDocuments, ...packingDocuments]) {
    const conf = doc.extractionConfidence
      ? Number(doc.extractionConfidence)
      : null;
    if (conf !== null && conf < 0.6) {
      checks.push({
        importCaseId: caseId,
        documentId: doc.id,
        checkType: "low_extraction_confidence",
        severity: "warning",
        title: "Low extraction confidence",
        message: `Extraction confidence for "${doc.originalFileName}" is ${(conf * 100).toFixed(0)}%. Human review recommended.`,
        details: { confidence: conf, fileName: doc.originalFileName },
      });
    }
    if (doc.extractionStatus === "failed") {
      checks.push({
        importCaseId: caseId,
        documentId: doc.id,
        checkType: "extraction_failed",
        severity: "error",
        title: "Document extraction failed",
        message: `Could not extract data from "${doc.originalFileName}". Re-upload or enter lines manually.`,
        details: { fileName: doc.originalFileName },
      });
    }
  }

  // Quantity mismatches — match by line number, then SKU
  const maxLines = Math.max(invLines.length, packLines.length);
  for (let i = 0; i < maxLines; i++) {
    const inv = invLines[i];
    const pack =
      packLines.find((p) => p.lineNumber === inv?.lineNumber) ??
      (inv?.supplierSku
        ? packLines.find((p) => p.supplierSku === inv.supplierSku)
        : undefined) ??
      packLines[i];

    if (!inv || !pack) continue;

    const invQty = qtyNum(inv.quantity);
    const packQty = qtyNum(pack.quantity);
    if (invQty !== null && packQty !== null && invQty !== packQty) {
      checks.push({
        importCaseId: caseId,
        checkType: "quantity_mismatch",
        severity: "error",
        title: "Quantity mismatch between invoice and packing list",
        message: `Line ${inv.lineNumber}: invoice quantity is ${invQty} ${inv.unitOfMeasure}, but packing list quantity is ${packQty} ${pack.unitOfMeasure}.`,
        details: {
          lineNumber: inv.lineNumber,
          invoiceLineId: inv.id,
          packingLineId: pack.id,
          invoiceQty: invQty,
          packingQty: packQty,
          invoiceDescription: inv.supplierDescription,
          packingDescription: pack.supplierDescription,
        },
      });
    }
  }

  // Missing country of origin on invoice lines
  const missingOrigin = invLines.filter((l) => !l.countryOfOriginCode);
  if (missingOrigin.length > 0) {
    checks.push({
      importCaseId: caseId,
      checkType: "missing_country_of_origin",
      severity: "warning",
      title: "Missing country of origin",
      message: `${missingOrigin.length} invoice line(s) have no country of origin.`,
      details: { lineNumbers: missingOrigin.map((l) => l.lineNumber) },
    });
  }

  // Vague descriptions
  for (const line of invLines) {
    if (line.supplierDescription.trim().split(/\s+/).length < 2) {
      checks.push({
        importCaseId: caseId,
        documentId: line.documentId,
        checkType: "vague_description",
        severity: "warning",
        title: "Product description may be too vague",
        message: `Invoice line ${line.lineNumber}: "${line.supplierDescription}" may need more detail for HS classification.`,
        details: { lineNumber: line.lineNumber, lineId: line.id },
      });
    }
  }

  // Replace open auto-checks (keep resolved/ignored)
  await db
    .delete(documentChecks)
    .where(
      and(
        eq(documentChecks.importCaseId, caseId),
        eq(documentChecks.status, "open"),
      ),
    );

  if (checks.length > 0) {
    await db.insert(documentChecks).values(
      checks.map((c) => ({
        importCaseId: c.importCaseId,
        documentId: c.documentId ?? null,
        checkType: c.checkType,
        severity: c.severity,
        status: "open" as const,
        title: c.title,
        message: c.message,
        details: c.details ?? null,
      })),
    );
  }

  return checks.length;
}

export async function getCaseChecks(caseId: string) {
  const rows = await db
    .select()
    .from(documentChecks)
    .where(eq(documentChecks.importCaseId, caseId));

  const severityOrder = { error: 0, warning: 1, info: 2 };
  return rows.sort((a, b) => {
    const sa = severityOrder[a.severity as keyof typeof severityOrder] ?? 3;
    const sb = severityOrder[b.severity as keyof typeof severityOrder] ?? 3;
    if (sa !== sb) return sa - sb;
    return (
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });
}

export async function countOpenChecks(caseId: string): Promise<number> {
  const rows = await db
    .select()
    .from(documentChecks)
    .where(eq(documentChecks.importCaseId, caseId));
  return rows.filter((r) => r.status === "open").length;
}
