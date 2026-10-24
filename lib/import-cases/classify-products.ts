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
import { mapWithConcurrency, stableHash } from "./harmonize-plan";
import { AI_MODEL_NAME, PROMPT_VERSION } from "./extraction-schemas";
import { lookupTariffForHsCode, parseDutyRate, dutyRateOtherCharges } from "./tariff-lookup";
import { writeAuditLog } from "./queries";
import { persistVddMatchesForProduct } from "@/lib/vdd/persist-product-matches";
import type { VddScoredMatch } from "@/lib/vdd/score-match";
import { vddProductMatches } from "@/db/schema";

export type ClassifyResult = {
  classifiedCount: number;
  needsReviewCount: number;
  skippedCount: number;
  referencePopulated: boolean;
};

async function updateHsCodeMatchFlags(
  productId: string,
  suggestedHs: string,
  matches: VddScoredMatch[],
) {
  const normalized = suggestedHs.replace(/\D/g, "");
  for (const m of matches) {
    const vddHs = m.record.hsCode.replace(/\D/g, "");
    const hsCodeMatches =
      normalized.length > 0 &&
      vddHs.length > 0 &&
      (normalized === vddHs ||
        normalized.startsWith(vddHs) ||
        vddHs.startsWith(normalized));
    await db
      .update(vddProductMatches)
      .set({ hsCodeMatches })
      .where(
        and(
          eq(vddProductMatches.productId, productId),
          eq(vddProductMatches.vddReferenceRecordId, m.record.id),
        ),
      );
  }
}

function confidenceLevel(score: number): string {
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

function mapSourceToClassificationSource(
  source: ProductClassifySource,
): ClassificationSource {
  if (source === "rule_fallback") return "expert_review";
  if (source === "vdd_consensus") return "reference_match";
  return source;
}

function buildReasoning(
  result: Awaited<ReturnType<typeof classifyProductDescription>>,
): string {
  const vddNote =
    result.vddEvidence && result.vddEvidence.similarRecordsUsed > 0
      ? ` VDD: ${result.vddEvidence.similarRecordsUsed} similar record(s); ${
          result.vddEvidence.hsCodeConsensus[0]
            ? `historical consensus ${result.vddEvidence.hsCodeConsensus[0].hsCode} (${result.vddEvidence.hsCodeConsensus[0].count})`
            : "no HS consensus"
        }.`
      : "";

  if (result.source === "vdd_consensus") {
    return `VDD brand/model consensus (review only): ${result.hsCode} — ${result.cleanDescription}.${vddNote}`;
  }
  if (result.source === "reference_match") {
    const tariffNo = result.referenceMeta?.tariffNo;
    const score = result.referenceMeta?.score;
    return `Tariff reference match${tariffNo ? ` (${tariffNo})` : ""}${score != null ? `, score ${score}` : ""}: ${result.cleanDescription}.${vddNote}`;
  }
  if (result.source === "rule_fallback") {
    return `Rule-based fallback (no reference match, AI unavailable): ${result.cleanDescription}.${vddNote}`;
  }
  const noteNote = result.noteReference
    ? ` HS note applied: ${result.noteReference}.`
    : "";
  return `AI classification: ${result.category}. ${result.cleanDescription}.${noteNote}${vddNote}`;
}

function buildClassificationEvidence(
  result: Awaited<ReturnType<typeof classifyProductDescription>>,
): Record<string, unknown> {
  const vddBlock =
    result.vddEvidence && result.vddEvidence.similarRecordsUsed > 0
      ? {
          vddComparison: {
            similarRecordsUsed: result.vddEvidence.similarRecordsUsed,
            matchingAttributes: result.vddEvidence.matchingAttributes,
            differentAttributes: result.vddEvidence.differentAttributes,
            hsCodeConsensus: result.vddEvidence.hsCodeConsensus,
          },
          disclaimer:
            "VDD references support review only. They do not determine the final HS code or customs value.",
        }
      : {};

  if (result.source === "reference_match" && result.referenceMeta) {
    return {
      source: "reference_match",
      category: result.category,
      referenceMeta: result.referenceMeta,
      ...vddBlock,
    };
  }
  return {
    source: result.source,
    category: result.category,
    aiRawResponse: result.aiRawResponse ?? null,
    ...(result.noteReference ? { noteReference: result.noteReference } : {}),
    ...vddBlock,
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
    result.source === "vdd_consensus"
      ? "vdd_consensus"
      : result.source === "reference_match"
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

type ProductRow = typeof importProducts.$inferSelect;

const ELIGIBLE_STATUSES = new Set([
  "ready_for_hs_suggestion",
  "hs_suggested",
  "needs_expert_review",
]);

/** Human-verified products of a case that can be (re)classified, in sequence order. */
async function loadEligibleProducts(
  caseId: string,
  productIds?: string[],
): Promise<ProductRow[]> {
  let products = await db
    .select()
    .from(importProducts)
    .where(
      and(
        eq(importProducts.importCaseId, caseId),
        eq(importProducts.humanVerified, true),
      ),
    )
    .orderBy(importProducts.productSequence);

  if (productIds?.length) {
    const idSet = new Set(productIds);
    products = products.filter((p) => idSet.has(p.id));
  }

  return products.filter((p) => ELIGIBLE_STATUSES.has(p.status));
}

/**
 * Classify and persist one product: VDD matches, tariff reference first, AI
 * with HS chapter notes as fallback, then the same writes as always.
 * `source` is where the suggestion came from (null when skipped).
 */
async function classifyProductRow(
  product: ProductRow,
  tenantId: string,
  forceAi: boolean,
): Promise<PersistClassificationOutcome & { source: ProductClassifySource | null }> {
  const description =
    product.normalizedDescription ?? product.rawDescription ?? "";
  if (!description.trim()) {
    return { kind: "skipped", source: null };
  }

  const vddResult = await persistVddMatchesForProduct(tenantId, product);
  const vddMatches: VddScoredMatch[] = vddResult.matches.slice(0, 5);

  const result = await classifyProductDescription(description, {
    country: product.countryOfOriginCode ?? undefined,
    unit: product.unitOfMeasure ?? undefined,
    forceAi,
    vddMatches,
  });

  // Mark whether suggested HS aligns with any top VDD HS (informational only)
  if (vddMatches.length > 0 && result.hsCode && !isExcludedHsCode(result.hsCode)) {
    await updateHsCodeMatchFlags(product.id, result.hsCode, vddMatches);
  }

  const outcome = await persistProductClassification(product, result);
  return { ...outcome, source: result.source };
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

  const eligible = await loadEligibleProducts(caseId, options?.productIds);

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
    const outcome = await classifyProductRow(product, tenantId, forceAi);
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

/* ------------------------------------------------------------------ */
/* Batched run (used by the classification progress dialog)            */
/* ------------------------------------------------------------------ */

/** Products classified in parallel inside one batch request. */
const CLASSIFY_CONCURRENCY = 3;

export class ClassifyPlanChangedError extends Error {
  constructor() {
    super(
      "The set of products to classify changed while classifying. Start classification again.",
    );
    this.name = "ClassifyPlanChangedError";
  }
}

function classifyPlanKey(products: ProductRow[]): string {
  return stableHash(products.map((p) => `${p.productSequence}:${p.id}`));
}

export type ClassifyStartInfo = {
  planKey: string;
  total: number;
  /** product_sequence of every product this run classifies, in order. */
  sequences: number[];
  referencePopulated: boolean;
};

/** Step 1: choose the products and clear their old suggestions (same as before). */
export async function startClassifyRun(
  caseId: string,
  options?: { replaceExisting?: boolean },
): Promise<ClassifyStartInfo> {
  const replaceExisting = options?.replaceExisting ?? true;
  const referencePopulated = await isHsReferenceAvailable();
  const eligible = await loadEligibleProducts(caseId);

  if (eligible.length === 0) {
    throw new Error("No human-verified products ready for HS classification");
  }

  if (replaceExisting) {
    await clearProductClassificationData(eligible.map((p) => p.id));
  }

  return {
    planKey: classifyPlanKey(eligible),
    total: eligible.length,
    sequences: eligible.map((p) => p.productSequence),
    referencePopulated,
  };
}

export type ClassifyProductResult =
  | {
      sequence: number;
      ok: true;
      outcome: "classified" | "needs_review" | "skipped";
      /** Suggested from the tariff reference or VDD (no AI call). */
      viaReference: boolean;
      /** Already classified earlier in this run; nothing was redone. */
      reused: boolean;
    }
  | { sequence: number; ok: false; error: string };

/**
 * Step 2 (repeat): classify these products. Idempotent: a product that already
 * has a classification from this run is reported, not redone; leftovers of a
 * half-finished attempt are cleared before trying again.
 */
export async function classifyProductSequences(
  caseId: string,
  tenantId: string,
  planKey: string,
  sequences: number[],
  options?: { forceAi?: boolean },
): Promise<ClassifyProductResult[]> {
  const forceAi = options?.forceAi ?? false;
  const eligible = await loadEligibleProducts(caseId);
  if (classifyPlanKey(eligible) !== planKey) throw new ClassifyPlanChangedError();

  const bySequence = new Map(eligible.map((p) => [p.productSequence, p]));
  const unique = [...new Set(sequences)].sort((a, b) => a - b);

  return mapWithConcurrency(
    unique,
    CLASSIFY_CONCURRENCY,
    async (sequence): Promise<ClassifyProductResult> => {
      const product = bySequence.get(sequence);
      if (!product) {
        return { sequence, ok: false, error: "Unknown product sequence" };
      }
      try {
        const [existing] = await db
          .select({ source: productClassifications.source })
          .from(productClassifications)
          .where(eq(productClassifications.productId, product.id))
          .limit(1);
        if (existing) {
          return {
            sequence,
            ok: true,
            outcome:
              product.status === "needs_expert_review"
                ? "needs_review"
                : "classified",
            viaReference: existing.source === "reference_match",
            reused: true,
          };
        }

        // drop leftovers of an attempt that was cut off half-way
        await clearProductClassificationData([product.id]);

        const outcome = await classifyProductRow(product, tenantId, forceAi);
        return {
          sequence,
          ok: true,
          outcome: outcome.kind,
          viaReference:
            outcome.source === "reference_match" ||
            outcome.source === "vdd_consensus",
          reused: false,
        };
      } catch (error) {
        return {
          sequence,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );
}

/** Step 3: case status + audit entry (same as before), counts read from the database. */
export async function finalizeClassifyRun(
  caseId: string,
  tenantId: string,
  userId: string | null | undefined,
  planKey: string,
): Promise<ClassifyResult> {
  const eligible = await loadEligibleProducts(caseId);
  if (classifyPlanKey(eligible) !== planKey) throw new ClassifyPlanChangedError();

  const ids = eligible.map((p) => p.id);
  const withSuggestion = new Set(
    ids.length === 0
      ? []
      : (
          await db
            .select({ productId: productClassifications.productId })
            .from(productClassifications)
            .where(inArray(productClassifications.productId, ids))
        ).map((r) => r.productId),
  );

  const needsReviewCount = eligible.filter(
    (p) => p.status === "needs_expert_review",
  ).length;
  const classifiedCount = eligible.filter(
    (p) => p.status === "hs_suggested" && withSuggestion.has(p.id),
  ).length;
  const skippedCount = Math.max(
    0,
    eligible.length - classifiedCount - needsReviewCount,
  );

  const referencePopulated = await isHsReferenceAvailable();

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

  return { classifiedCount, needsReviewCount, skippedCount, referencePopulated };
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

  const vddResult = await persistVddMatchesForProduct(tenantId, product);
  const vddMatches: VddScoredMatch[] = vddResult.matches.slice(0, 5);

  const result = await classifyProductDescription(description, {
    country: product.countryOfOriginCode ?? undefined,
    unit: product.unitOfMeasure ?? undefined,
    forceAi,
    vddMatches,
  });

  if (vddMatches.length > 0 && result.hsCode && !isExcludedHsCode(result.hsCode)) {
    await updateHsCodeMatchFlags(product.id, result.hsCode, vddMatches);
  }

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
