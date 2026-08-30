import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  hsCodeCandidates,
  importCases,
  importProducts,
  productClassifications,
  tariffSnapshots,
} from "@/db/schema";
import { isExcludedHsCode } from "@/lib/allowedHsCodes";
import {
  classifyProductDescription,
  isHsReferenceAvailable,
  type ProductClassifySource,
} from "./classify-product-description";
import type { ClassificationSource } from "./constants";
import { TARIFF_VERSION } from "./constants";
import { AI_MODEL_NAME, PROMPT_VERSION } from "./extraction-schemas";
import { lookupTariffForHsCode, parseDutyRate, dutyRateOtherCharges } from "./tariff-lookup";
import { writeAuditLog } from "./queries";

export type ClassifyResult = {
  classifiedCount: number;
  needsReviewCount: number;
  skippedCount: number;
  referencePopulated: boolean;
};

function confidenceLevel(score: number): string {
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

function mapSourceToClassificationSource(
  source: ProductClassifySource,
): ClassificationSource {
  if (source === "rule_fallback") return "expert_review";
  return source;
}

function buildReasoning(
  result: Awaited<ReturnType<typeof classifyProductDescription>>,
): string {
  if (result.source === "reference_match") {
    const tariffNo = result.referenceMeta?.tariffNo;
    const score = result.referenceMeta?.score;
    return `Tariff reference match${tariffNo ? ` (${tariffNo})` : ""}${score != null ? `, score ${score}` : ""}: ${result.cleanDescription}`;
  }
  if (result.source === "rule_fallback") {
    return `Rule-based fallback (no reference match, AI unavailable): ${result.cleanDescription}`;
  }
  return `AI classification: ${result.category}. ${result.cleanDescription}`;
}

function buildClassificationEvidence(
  result: Awaited<ReturnType<typeof classifyProductDescription>>,
): Record<string, unknown> {
  if (result.source === "reference_match" && result.referenceMeta) {
    return {
      source: "reference_match",
      category: result.category,
      referenceMeta: result.referenceMeta,
    };
  }
  return {
    source: result.source,
    category: result.category,
    aiRawResponse: result.aiRawResponse ?? null,
  };
}

async function clearProductClassificationData(productIds: string[]) {
  if (productIds.length === 0) return;

  await db
    .delete(hsCodeCandidates)
    .where(inArray(hsCodeCandidates.productId, productIds));
  await db
    .delete(productClassifications)
    .where(inArray(productClassifications.productId, productIds));
  await db
    .delete(tariffSnapshots)
    .where(inArray(tariffSnapshots.productId, productIds));
}

type PersistClassificationOutcome =
  | { kind: "classified" }
  | { kind: "needs_review" }
  | { kind: "skipped" };

async function persistProductClassification(
  product: typeof importProducts.$inferSelect,
  result: Awaited<ReturnType<typeof classifyProductDescription>>,
): Promise<PersistClassificationOutcome> {
  if (!result.isImportItem || isExcludedHsCode(result.hsCode)) {
    await db
      .update(importProducts)
      .set({
        status: "needs_expert_review",
        updatedAt: new Date(),
      })
      .where(eq(importProducts.id, product.id));
    return { kind: "needs_review" };
  }

  const confidence = result.confidence ?? 0.7;
  const tariff = await lookupTariffForHsCode(result.hsCode);
  const tariffVersion = tariff.tariffVersion || TARIFF_VERSION || "ETH-2024";
  const officialDescription =
    tariff.officialDescription || result.cleanDescription;
  const classificationSource = mapSourceToClassificationSource(result.source);
  const aiModelName =
    result.source === "reference_match"
      ? "reference_match"
      : result.source === "rule_fallback"
        ? "rule_fallback"
        : AI_MODEL_NAME;

  const [candidate] = await db
    .insert(hsCodeCandidates)
    .values({
      productId: product.id,
      tariffVersion,
      hsCode: result.hsCode,
      officialDescription,
      rank: 1,
      confidenceScore: confidence.toFixed(4),
      confidenceLevel: confidenceLevel(confidence),
      reasoning: buildReasoning(result),
      classificationEvidence: buildClassificationEvidence(result),
      missingInformation: [],
      aiModelName,
      promptVersion: PROMPT_VERSION,
    })
    .returning();

  await db.insert(productClassifications).values({
    productId: product.id,
    status:
      confidence < 0.6 || result.source === "rule_fallback"
        ? "needs_review"
        : "suggested",
    hsCode: result.hsCode,
    tariffVersion,
    officialDescription,
    classificationBasis: result.category,
    source: classificationSource,
    selectedCandidateId: candidate.id,
    isFinal: false,
  });

  await db.insert(tariffSnapshots).values({
    productId: product.id,
    hsCode: result.hsCode,
    tariffVersion,
    countryOfOriginCode: product.countryOfOriginCode,
    customsDutyRate: parseDutyRate(tariff.customsDutyRate ?? tariff.dutyRateDisplay),
    otherCharges: dutyRateOtherCharges(tariff.dutyRateDisplay),
    sourceReference: tariff.sourceReference,
  });

  const productStatus =
    confidence < 0.6 ||
    result.hsCode.startsWith("9999") ||
    result.source === "rule_fallback"
      ? "needs_expert_review"
      : "hs_suggested";

  await db
    .update(importProducts)
    .set({
      status: productStatus,
      updatedAt: new Date(),
    })
    .where(eq(importProducts.id, product.id));

  return productStatus === "needs_expert_review"
    ? { kind: "needs_review" }
    : { kind: "classified" };
}

export async function classifyImportCaseProducts(
  caseId: string,
  tenantId: string,
  userId?: string | null,
  options?: {
    productIds?: string[];
    replaceExisting?: boolean;
    forceAi?: boolean;
  },
): Promise<ClassifyResult> {
  const replaceExisting = options?.replaceExisting ?? true;
  const forceAi = options?.forceAi ?? false;
  const referencePopulated = await isHsReferenceAvailable();

  const conditions = [
    eq(importProducts.importCaseId, caseId),
    eq(importProducts.humanVerified, true),
  ];

  let products = await db
    .select()
    .from(importProducts)
    .where(and(...conditions))
    .orderBy(importProducts.productSequence);

  if (options?.productIds?.length) {
    const idSet = new Set(options.productIds);
    products = products.filter((p) => idSet.has(p.id));
  }

  const eligible = products.filter(
    (p) =>
      p.status === "ready_for_hs_suggestion" ||
      p.status === "hs_suggested" ||
      p.status === "needs_expert_review",
  );

  if (eligible.length === 0) {
    throw new Error(
      "No human-verified products ready for HS classification",
    );
  }

  if (replaceExisting) {
    await clearProductClassificationData(eligible.map((p) => p.id));
  }

  let classifiedCount = 0;
  let needsReviewCount = 0;
  let skippedCount = 0;

  for (const product of eligible) {
    const description =
      product.normalizedDescription ?? product.rawDescription ?? "";
    if (!description.trim()) {
      skippedCount++;
      continue;
    }

    const result = await classifyProductDescription(description, {
      country: product.countryOfOriginCode ?? undefined,
      unit: product.unitOfMeasure ?? undefined,
      forceAi,
    });

    const outcome = await persistProductClassification(product, result);
    if (outcome.kind === "skipped") {
      skippedCount++;
    } else if (outcome.kind === "needs_review") {
      needsReviewCount++;
    } else {
      classifiedCount++;
    }
  }

  await db
    .update(importCases)
    .set({
      status: "classification_in_review",
      updatedAt: new Date(),
    })
    .where(eq(importCases.id, caseId));

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId: userId ?? null,
    entityType: "import_case",
    entityId: caseId,
    action: "classification_suggested",
    newData: {
      classifiedCount,
      needsReviewCount,
      skippedCount,
      referencePopulated,
    },
  });

  return {
    classifiedCount,
    needsReviewCount,
    skippedCount,
    referencePopulated,
  };
}

export type SingleClassifyResult = {
  productId: string;
  hsCode: string | null;
  source: ProductClassifySource | null;
  needsReview: boolean;
};

/** Classify one product, optionally forcing AI instead of tariff reference. */
export async function classifySingleImportProduct(
  caseId: string,
  tenantId: string,
  productId: string,
  userId?: string | null,
  options?: { forceAi?: boolean },
): Promise<SingleClassifyResult> {
  const forceAi = options?.forceAi ?? true;

  const [product] = await db
    .select()
    .from(importProducts)
    .where(
      and(
        eq(importProducts.id, productId),
        eq(importProducts.importCaseId, caseId),
        eq(importProducts.humanVerified, true),
      ),
    )
    .limit(1);

  if (!product) {
    throw new Error("Product not found or not human-verified");
  }

  if (product.status === "approved_for_declaration") {
    throw new Error("Product is already approved for declaration");
  }

  const description =
    product.normalizedDescription ?? product.rawDescription ?? "";
  if (!description.trim()) {
    throw new Error("Product has no description to classify");
  }

  await clearProductClassificationData([product.id]);

  const result = await classifyProductDescription(description, {
    country: product.countryOfOriginCode ?? undefined,
    unit: product.unitOfMeasure ?? undefined,
    forceAi,
  });

  const outcome = await persistProductClassification(product, result);

  await db
    .update(importCases)
    .set({
      status: "classification_in_review",
      updatedAt: new Date(),
    })
    .where(eq(importCases.id, caseId));

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId: userId ?? null,
    entityType: "import_product",
    entityId: productId,
    action: forceAi ? "classification_ai_requested" : "classification_suggested",
    newData: {
      source: result.source,
      hsCode: isExcludedHsCode(result.hsCode) ? null : result.hsCode,
      forceAi,
    },
  });

  return {
    productId,
    hsCode: isExcludedHsCode(result.hsCode) ? null : result.hsCode,
    source: result.source,
    needsReview: outcome.kind === "needs_review",
  };
}
