import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  hsCodeCandidates,
  importCases,
  importProducts,
  productClassifications,
  tariffSnapshots,
} from "@/db/schema";
import { lookupTariffForHsCode, parseDutyRate, dutyRateOtherCharges } from "./tariff-lookup";
import { writeAuditLog } from "./queries";

export type ApproveClassificationInput = {
  candidateId?: string;
  hsCode?: string;
  officialDescription?: string;
  reviewerReason?: string;
};

export async function approveProductClassification(
  caseId: string,
  productId: string,
  tenantId: string,
  userId: string,
  input: ApproveClassificationInput,
) {
  const [product] = await db
    .select()
    .from(importProducts)
    .where(
      and(
        eq(importProducts.id, productId),
        eq(importProducts.importCaseId, caseId),
      ),
    )
    .limit(1);

  if (!product) throw new Error("Product not found");

  const [existing] = await db
    .select()
    .from(productClassifications)
    .where(eq(productClassifications.productId, productId))
    .limit(1);

  let hsCode: string;
  let officialDescription: string;
  let tariffVersion: string;
  let selectedCandidateId: string | null = null;
  let source: string;

  if (input.candidateId) {
    const [candidate] = await db
      .select()
      .from(hsCodeCandidates)
      .where(
        and(
          eq(hsCodeCandidates.id, input.candidateId),
          eq(hsCodeCandidates.productId, productId),
        ),
      )
      .limit(1);

    if (!candidate) throw new Error("Candidate not found");
    hsCode = candidate.hsCode;
    officialDescription = candidate.officialDescription;
    tariffVersion = candidate.tariffVersion;
    selectedCandidateId = candidate.id;
    source = "ai_suggestion";
  } else if (input.hsCode) {
    const tariff = await lookupTariffForHsCode(input.hsCode);
    hsCode = input.hsCode;
    officialDescription =
      input.officialDescription ?? tariff.officialDescription;
    tariffVersion = tariff.tariffVersion;
    source = "manual_override";
  } else if (existing) {
    hsCode = existing.hsCode;
    officialDescription = existing.officialDescription;
    tariffVersion = existing.tariffVersion;
    selectedCandidateId = existing.selectedCandidateId;
    source = existing.source;
  } else {
    throw new Error("No classification to approve — provide candidateId or hsCode");
  }

  let classification;
  if (existing) {
    [classification] = await db
      .update(productClassifications)
      .set({
        status: "approved",
        hsCode,
        officialDescription,
        tariffVersion,
        selectedCandidateId,
        source,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewerReason: input.reviewerReason ?? null,
        isFinal: true,
        updatedAt: new Date(),
      })
      .where(eq(productClassifications.id, existing.id))
      .returning();
  } else {
    [classification] = await db
      .insert(productClassifications)
      .values({
        productId,
        status: "approved",
        hsCode,
        officialDescription,
        tariffVersion,
        selectedCandidateId,
        source,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewerReason: input.reviewerReason ?? null,
        isFinal: true,
      })
      .returning();
  }

  const tariff = await lookupTariffForHsCode(hsCode);
  const [existingSnapshot] = await db
    .select()
    .from(tariffSnapshots)
    .where(eq(tariffSnapshots.productId, productId))
    .limit(1);

  if (existingSnapshot) {
    await db
      .update(tariffSnapshots)
      .set({
        hsCode,
        tariffVersion: tariff.tariffVersion,
        customsDutyRate: parseDutyRate(
          tariff.customsDutyRate ?? tariff.dutyRateDisplay,
        ),
        otherCharges: dutyRateOtherCharges(tariff.dutyRateDisplay),
        sourceReference: tariff.sourceReference,
        retrievedAt: new Date(),
      })
      .where(eq(tariffSnapshots.id, existingSnapshot.id));
  } else {
    await db.insert(tariffSnapshots).values({
      productId,
      hsCode,
      tariffVersion: tariff.tariffVersion,
      countryOfOriginCode: product.countryOfOriginCode,
      customsDutyRate: parseDutyRate(
        tariff.customsDutyRate ?? tariff.dutyRateDisplay,
      ),
      otherCharges: dutyRateOtherCharges(tariff.dutyRateDisplay),
      sourceReference: tariff.sourceReference,
    });
  }

  const [updatedProduct] = await db
    .update(importProducts)
    .set({
      status: "approved_for_declaration",
      updatedAt: new Date(),
    })
    .where(eq(importProducts.id, productId))
    .returning();

  await maybeUpdateCaseStatus(caseId);

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId,
    entityType: "import_product",
    entityId: productId,
    action: "classification_approved",
    newData: { hsCode, source },
    reason: input.reviewerReason ?? null,
  });

  return { product: updatedProduct, classification };
}

async function maybeUpdateCaseStatus(caseId: string) {
  const products = await db
    .select({ status: importProducts.status })
    .from(importProducts)
    .where(eq(importProducts.importCaseId, caseId));

  if (products.length === 0) return;

  const allApproved = products.every(
    (p) =>
      p.status === "approved_for_declaration" || p.status === "classified",
  );

  if (allApproved) {
    await db
      .update(importCases)
      .set({
        status: "ready_for_declaration",
        updatedAt: new Date(),
      })
      .where(eq(importCases.id, caseId));
  }
}
