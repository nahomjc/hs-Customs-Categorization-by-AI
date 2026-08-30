import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  documentChecks,
  importCases,
  importProducts,
  invoiceLines,
  packingListLines,
  productClassifications,
  productInvoiceLines,
  productPackingListLines,
} from "@/db/schema";
import { approveProductClassification } from "./approve-classification";
import { writeAuditLog } from "./queries";

export type BulkReviewAction = "approve" | "override" | "reject";

export type BulkReviewResult = {
  affectedCount: number;
  action: BulkReviewAction;
};

async function updateCaseAfterBulkReview(
  caseId: string,
  status: string,
  reason?: string | null,
) {
  await db
    .update(importCases)
    .set({ status, updatedAt: new Date() })
    .where(eq(importCases.id, caseId));

  return reason;
}

export async function bulkReviewInvoiceLines(
  caseId: string,
  tenantId: string,
  userId: string,
  action: BulkReviewAction,
  reason?: string | null,
): Promise<BulkReviewResult> {
  const pending = await db
    .select({ id: invoiceLines.id })
    .from(invoiceLines)
    .where(
      and(eq(invoiceLines.importCaseId, caseId), eq(invoiceLines.isReviewed, false)),
    );

  if (pending.length === 0) {
    return { affectedCount: 0, action };
  }

  const ids = pending.map((row) => row.id);

  if (action === "approve" || action === "override") {
    await db
      .update(invoiceLines)
      .set({
        isReviewed: true,
        reviewedByUserId: userId,
        updatedAt: new Date(),
      })
      .where(inArray(invoiceLines.id, ids));
  } else {
    await db
      .update(importCases)
      .set({ status: "needs_information", updatedAt: new Date() })
      .where(eq(importCases.id, caseId));
  }

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId,
    entityType: "import_case",
    entityId: caseId,
    action: `invoice_lines_bulk_${action}`,
    newData: { count: pending.length },
    reason: reason ?? null,
  });

  return { affectedCount: pending.length, action };
}

export async function bulkReviewPackingListLines(
  caseId: string,
  tenantId: string,
  userId: string,
  action: BulkReviewAction,
  reason?: string | null,
): Promise<BulkReviewResult> {
  const pending = await db
    .select({ id: packingListLines.id })
    .from(packingListLines)
    .where(
      and(
        eq(packingListLines.importCaseId, caseId),
        eq(packingListLines.isReviewed, false),
      ),
    );

  if (pending.length === 0) {
    return { affectedCount: 0, action };
  }

  const ids = pending.map((row) => row.id);

  if (action === "approve" || action === "override") {
    await db
      .update(packingListLines)
      .set({
        isReviewed: true,
        reviewedByUserId: userId,
        updatedAt: new Date(),
      })
      .where(inArray(packingListLines.id, ids));
  } else {
    await updateCaseAfterBulkReview(caseId, "needs_information", reason);
  }

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId,
    entityType: "import_case",
    entityId: caseId,
    action: `packing_lines_bulk_${action}`,
    newData: { count: pending.length },
    reason: reason ?? null,
  });

  return { affectedCount: pending.length, action };
}

export async function bulkReviewChecks(
  caseId: string,
  tenantId: string,
  userId: string,
  action: BulkReviewAction,
  reason?: string | null,
): Promise<BulkReviewResult> {
  const openChecks = await db
    .select({ id: documentChecks.id })
    .from(documentChecks)
    .where(
      and(
        eq(documentChecks.importCaseId, caseId),
        eq(documentChecks.status, "open"),
      ),
    );

  if (openChecks.length === 0) {
    return { affectedCount: 0, action };
  }

  const ids = openChecks.map((row) => row.id);
  const newStatus =
    action === "reject" ? "ignored" : action === "override" ? "resolved" : "resolved";

  await db
    .update(documentChecks)
    .set({
      status: newStatus,
      resolvedByUserId: userId,
      resolvedAt: new Date(),
      resolutionNote: reason ?? null,
      updatedAt: new Date(),
    })
    .where(inArray(documentChecks.id, ids));

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId,
    entityType: "import_case",
    entityId: caseId,
    action: `checks_bulk_${action}`,
    newData: { count: openChecks.length, status: newStatus },
    reason: reason ?? null,
  });

  return { affectedCount: openChecks.length, action };
}

export async function bulkReviewProducts(
  caseId: string,
  tenantId: string,
  userId: string,
  action: BulkReviewAction,
  reason?: string | null,
): Promise<BulkReviewResult> {
  const pending = await db
    .select({ id: importProducts.id })
    .from(importProducts)
    .where(
      and(
        eq(importProducts.importCaseId, caseId),
        eq(importProducts.humanVerified, false),
      ),
    );

  if (pending.length === 0) {
    return { affectedCount: 0, action };
  }

  const ids = pending.map((row) => row.id);

  if (action === "approve" || action === "override") {
    await db
      .update(productInvoiceLines)
      .set({ isConfirmed: true })
      .where(inArray(productInvoiceLines.productId, ids));

    await db
      .update(productPackingListLines)
      .set({ isConfirmed: true })
      .where(inArray(productPackingListLines.productId, ids));

    await db
      .update(importProducts)
      .set({
        humanVerified: true,
        verifiedByUserId: userId,
        verifiedAt: new Date(),
        status: "ready_for_hs_suggestion",
        updatedAt: new Date(),
      })
      .where(inArray(importProducts.id, ids));
  } else {
    await db
      .update(importProducts)
      .set({
        status: "rejected",
        updatedAt: new Date(),
      })
      .where(inArray(importProducts.id, ids));

    await updateCaseAfterBulkReview(caseId, "needs_information", reason);
  }

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId,
    entityType: "import_case",
    entityId: caseId,
    action: `products_bulk_${action}`,
    newData: { count: pending.length },
    reason: reason ?? null,
  });

  return { affectedCount: pending.length, action };
}

export async function bulkReviewClassifications(
  caseId: string,
  tenantId: string,
  userId: string,
  action: BulkReviewAction,
  options?: { reason?: string | null; overrideHsCode?: string | null },
): Promise<BulkReviewResult> {
  const rows = await db
    .select({
      productId: importProducts.id,
      classificationId: productClassifications.id,
      isFinal: productClassifications.isFinal,
      selectedCandidateId: productClassifications.selectedCandidateId,
      hsCode: productClassifications.hsCode,
    })
    .from(importProducts)
    .innerJoin(
      productClassifications,
      eq(productClassifications.productId, importProducts.id),
    )
    .where(
      and(
        eq(importProducts.importCaseId, caseId),
        eq(importProducts.humanVerified, true),
        eq(productClassifications.isFinal, false),
      ),
    );

  if (rows.length === 0) {
    return { affectedCount: 0, action };
  }

  let affectedCount = 0;

  if (action === "approve" || action === "override") {
    for (const row of rows) {
      if (action === "override" && options?.overrideHsCode) {
        await approveProductClassification(caseId, row.productId, tenantId, userId, {
          hsCode: options.overrideHsCode,
          reviewerReason: options.reason ?? undefined,
        });
      } else if (row.selectedCandidateId) {
        await approveProductClassification(caseId, row.productId, tenantId, userId, {
          candidateId: row.selectedCandidateId,
          reviewerReason: options?.reason ?? undefined,
        });
      } else if (row.hsCode) {
        await approveProductClassification(caseId, row.productId, tenantId, userId, {
          hsCode: row.hsCode,
          reviewerReason: options?.reason ?? undefined,
        });
      }
      affectedCount++;
    }
  } else {
    const productIds = rows.map((row) => row.productId);
    const classificationIds = rows.map((row) => row.classificationId);

    await db
      .update(productClassifications)
      .set({
        status: "rejected",
        isFinal: false,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewerReason: options?.reason ?? null,
        updatedAt: new Date(),
      })
      .where(inArray(productClassifications.id, classificationIds));

    await db
      .update(importProducts)
      .set({
        status: "needs_expert_review",
        updatedAt: new Date(),
      })
      .where(inArray(importProducts.id, productIds));

    await updateCaseAfterBulkReview(caseId, "classification_in_review", options?.reason);

    affectedCount = rows.length;
  }

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId,
    entityType: "import_case",
    entityId: caseId,
    action: `classifications_bulk_${action}`,
    newData: { count: affectedCount, overrideHsCode: options?.overrideHsCode ?? null },
    reason: options?.reason ?? null,
  });

  return { affectedCount, action };
}
