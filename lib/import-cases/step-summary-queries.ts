import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  documentChecks,
  importCaseDocuments,
  importProducts,
  invoiceLines,
  packingListLines,
  productGroupings,
} from "@/db/schema";
import type { StepSummary } from "./step-gate";

/**
 * Fresh counts for the wizard's Continue check, straight from the database
 * (a handful of COUNT queries, no row payloads).
 */
export async function getCaseStepSummary(caseId: string): Promise<StepSummary> {
  const [
    documents,
    [invoiceTotal],
    [invoiceOpen],
    [packingTotal],
    [packingOpen],
    [productTotal],
    [productVerified],
    [verifiedUnapproved],
    [groupTotal],
    [checksOpen],
  ] = await Promise.all([
    db
      .select({
        documentType: importCaseDocuments.documentType,
        extractionStatus: importCaseDocuments.extractionStatus,
      })
      .from(importCaseDocuments)
      .where(eq(importCaseDocuments.importCaseId, caseId)),
    db.select({ n: count() }).from(invoiceLines).where(eq(invoiceLines.importCaseId, caseId)),
    db
      .select({ n: count() })
      .from(invoiceLines)
      .where(and(eq(invoiceLines.importCaseId, caseId), eq(invoiceLines.isReviewed, false))),
    db.select({ n: count() }).from(packingListLines).where(eq(packingListLines.importCaseId, caseId)),
    db
      .select({ n: count() })
      .from(packingListLines)
      .where(and(eq(packingListLines.importCaseId, caseId), eq(packingListLines.isReviewed, false))),
    db.select({ n: count() }).from(importProducts).where(eq(importProducts.importCaseId, caseId)),
    db
      .select({ n: count() })
      .from(importProducts)
      .where(and(eq(importProducts.importCaseId, caseId), eq(importProducts.humanVerified, true))),
    db
      .select({ n: count() })
      .from(importProducts)
      .where(
        and(
          eq(importProducts.importCaseId, caseId),
          eq(importProducts.humanVerified, true),
          sql`NOT EXISTS (SELECT 1 FROM product_classifications pc WHERE pc.product_id = ${importProducts.id} AND pc.is_final = true)`,
        ),
      ),
    db.select({ n: count() }).from(productGroupings).where(eq(productGroupings.importCaseId, caseId)),
    db
      .select({ n: count() })
      .from(documentChecks)
      .where(and(eq(documentChecks.importCaseId, caseId), eq(documentChecks.status, "open"))),
  ]);

  const products = productTotal?.n ?? 0;
  const verified = productVerified?.n ?? 0;
  return {
    hasInvoice: documents.some(
      (d) => d.documentType === "commercial_invoice" && d.extractionStatus === "completed",
    ),
    hasPacking: documents.some(
      (d) => d.documentType === "packing_list" && d.extractionStatus === "completed",
    ),
    invoiceLines: invoiceTotal?.n ?? 0,
    unreviewedInvoiceLines: invoiceOpen?.n ?? 0,
    packingLines: packingTotal?.n ?? 0,
    unreviewedPackingLines: packingOpen?.n ?? 0,
    products,
    unverifiedProducts: products - verified,
    verifiedProducts: verified,
    unapprovedVerifiedProducts: verifiedUnapproved?.n ?? 0,
    groupings: groupTotal?.n ?? 0,
    openChecks: checksOpen?.n ?? 0,
  };
}