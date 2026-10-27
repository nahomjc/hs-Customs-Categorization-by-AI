import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  hsCodeCandidates,
  importCases,
  importProducts,
  productClassifications,
  productGroupings,
  tariffSnapshots,
} from "@/db/schema";
import { checkPlausibility, needsRecheck, type PlausibilityVerdict } from "@/lib/hs-plausibility";
import { isExcludedHsCode } from "@/lib/allowedHsCodes";
import { completeHsCode } from "@/lib/hs-code-format";
import { getHsReferenceCacheRows } from "@/lib/hsReferenceCache";
import { NO_CLEAR_TARIFF_MATCH, isCatchAllHsCode } from "@/lib/hs-catch-all";
import type { WebSource } from "@/lib/hs-web-search";
import {
  classifyProductDescription,
  isHsReferenceAvailable,
  type ProductClassifySource,
} from "./classify-product-description";
import type { ClassificationSource } from "./constants";
import { TARIFF_VERSION } from "./constants";
import { mapWithConcurrency, stableHash } from "./harmonize-plan";
import type { SuggestionReview } from "./hs-web-step";
import { AI_MODEL_NAME, PROMPT_VERSION } from "./extraction-schemas";
import { lookupTariffForHsCode, parseDutyRate, dutyRateOtherCharges } from "./tariff-lookup";
import { writeAuditLog } from "./queries";
import { persistVddMatchesForProduct } from "@/lib/vdd/persist-product-matches";
import {
  getReviewerNote,
  sanitizeNote,
} from "./product-context";
import {
  loadProductContext,
  loadSupplierHsByProduct,
  saveProductNote,
} from "./product-context-load";
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
    if (result.referenceMeta?.tied && result.referenceMeta.tied.length > 1) {
      return `Tariff book: ${result.referenceMeta.tied.length} rows match "${result.referenceMeta.matchedOn ?? result.cleanDescription}" equally, none was picked. A person chooses.${vddNote}`;
    }
    return `Tariff reference match${tariffNo ? ` (${tariffNo})` : ""}${score != null ? `, score ${score}` : ""}: ${result.cleanDescription}.${vddNote}`;
  }
  if (result.source === "rule_fallback") {
    return `Rule-based fallback (no reference match, AI unavailable): ${result.cleanDescription}.${vddNote}`;
  }
  const noteNote = result.noteReference
    ? ` HS note applied: ${result.noteReference}.`
    : "";
  const review = result.review;
  const webNote = review?.web.used
    ? ` Web search${review.web.reasoning ? `: ${review.web.reasoning}` : " used."}${
        review.web.sources.length > 0
          ? ` (${review.web.sources.length} source${review.web.sources.length === 1 ? "" : "s"})`
          : ""
      }`
    : "";
  const reviewNote =
    review?.required && review.reason ? ` Needs review: ${review.reason}` : "";
  return `AI classification: ${result.category}. ${result.cleanDescription}.${noteNote}${webNote}${reviewNote}${vddNote}`;
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
      // a tie / invoice-code difference: the options and the question
      ...(result.review ? { review: result.review } : {}),
      ...vddBlock,
    };
  }
  return {
    source: result.source,
    category: result.category,
    aiRawResponse: result.aiRawResponse ?? null,
    ...(result.noteReference ? { noteReference: result.noteReference } : {}),
    ...(effectiveReview(result) ? { review: effectiveReview(result) } : {}),
    ...vddBlock,
  };
}

/** Review info stored with the suggestion; catch-alls always get a plain reason. */
function effectiveReview(
  result: Awaited<ReturnType<typeof classifyProductDescription>>,
): SuggestionReview | undefined {
  if (result.review) return result.review;
  if (isCatchAllHsCode(result.hsCode) && result.isImportItem) {
    return {
      required: true,
      reason: `${NO_CLEAR_TARIFF_MATCH}. Set the code by hand or add more detail to the product description.`,
      confidenceNote: "No code suggested",
      alternatives: [],
      web: { attempted: false, used: false, sources: [] },
    };
  }
  return undefined;
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
  | { kind: "classified"; review?: SuggestionReview }
  | { kind: "needs_review"; review?: SuggestionReview }
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

  // One display format: a short code becomes the full 8 digit code when the book has exactly one.
  if (!isCatchAllHsCode(result.hsCode)) {
    const done = completeHsCode(result.hsCode, getHsReferenceCacheRows());
    if (done.digits.length >= 4) result.hsCode = done.display;
  }

  const confidence = result.confidence ?? 0.7;
  const review = effectiveReview(result);
  // A catch-all (9999 and friends) is never "classified": it always needs review.
  const needsReview =
    confidence < 0.6 ||
    result.source === "rule_fallback" ||
    isCatchAllHsCode(result.hsCode) ||
    review?.required === true;
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
          : review?.web.used && review.web.model
            ? review.web.model.slice(0, 100)
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

  // Other real tariff codes the reviewer can choose instead (rank 2+).
  const alternatives = (review?.alternatives ?? []).slice(0, 4);
  for (let i = 0; i < alternatives.length; i++) {
    const alt = alternatives[i];
    await db.insert(hsCodeCandidates).values({
      productId: product.id,
      tariffVersion,
      hsCode: alt.hsCode,
      officialDescription: alt.officialDescription || alt.hsCode,
      rank: i + 2,
      // not scored: only the first suggestion carries a confidence
      confidenceScore: "0.0000",
      confidenceLevel: "low",
      reasoning: alt.reason ?? "Alternative suggestion",
      classificationEvidence: {
        role: "alternative",
        scored: false,
        inTariffBook: alt.inTariffBook,
      },
      missingInformation: [],
      aiModelName,
      promptVersion: PROMPT_VERSION,
    });
  }

  await db.insert(productClassifications).values({
    productId: product.id,
    status: needsReview ? "needs_review" : "suggested",
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

  const productStatus = needsReview ? "needs_expert_review" : "hs_suggested";

  await db
    .update(importProducts)
    .set({
      status: productStatus,
      updatedAt: new Date(),
    })
    .where(eq(importProducts.id, product.id));

  return productStatus === "needs_expert_review"
    ? { kind: "needs_review", review }
    : { kind: "classified", review };
}

type ProductRow = typeof importProducts.$inferSelect;

const ELIGIBLE_STATUSES = new Set([
  "ready_for_hs_suggestion",
  "hs_suggested",
  "needs_expert_review",
]);

/**
 * Human-verified products of a case that can be (re)classified, in sequence order.
 * `scopeSequences` limits the run to those products (the "re-check suspicious
 * codes" run): the plan key then covers only them.
 */
async function loadEligibleProducts(
  caseId: string,
  productIds?: string[],
  scopeSequences?: number[],
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
  if (scopeSequences) {
    const seqSet = new Set(scopeSequences);
    products = products.filter((p) => seqSet.has(p.productSequence));
  }

  return products.filter((p) => ELIGIBLE_STATUSES.has(p.status));
}

/* ------------------------------------------------------------------ */
/* Suspicious codes: a current code that does not fit the product      */
/* ------------------------------------------------------------------ */

export type SuspiciousProduct = {
  productId: string;
  sequence: number;
  name: string;
  hsCode: string;
  status: string;
  /** True when the code was typed by a person (never reset automatically). */
  manual: boolean;
  verdict: PlausibilityVerdict;
};

/**
 * Products whose CURRENT code fails the plausibility check (chapter / section
 * does not fit, or differs from the supplier's invoice code). Read only.
 */
export async function findSuspiciousProducts(
  caseId: string,
): Promise<SuspiciousProduct[]> {
  const products = await db
    .select()
    .from(importProducts)
    .where(
      and(
        eq(importProducts.importCaseId, caseId),
        eq(importProducts.humanVerified, true),
      ),
    )
    .orderBy(importProducts.productSequence);
  if (products.length === 0) return [];

  const ids = products.map((p) => p.id);
  const [classifications, supplierHs] = await Promise.all([
    db
      .select()
      .from(productClassifications)
      .where(inArray(productClassifications.productId, ids)),
    loadSupplierHsByProduct(caseId),
  ]);
  const byProduct = new Map(classifications.map((c) => [c.productId, c]));

  const out: SuspiciousProduct[] = [];
  for (const p of products) {
    const c = byProduct.get(p.id);
    if (!c) continue;
    const verdict = checkPlausibility({
      hsCode: c.hsCode,
      texts: [p.productName, p.rawDescription, p.normalizedDescription],
      supplierHsCode: supplierHs.get(p.id) ?? null,
      // a person already looked at it and approved: not suspicious again
      decidedByHuman: c.source === "manual_override" || c.isFinal === true,
    });
    if (!needsRecheck(verdict)) continue;
    out.push({
      productId: p.id,
      sequence: p.productSequence,
      name: (p.productName ?? p.normalizedDescription ?? p.rawDescription ?? "").slice(0, 120),
      hsCode: c.hsCode,
      status: p.status,
      manual: c.source === "manual_override",
      verdict,
    });
  }
  return out;
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
  const productContext = await loadProductContext(product);

  const result = await classifyProductDescription(description, {
    country: product.countryOfOriginCode ?? undefined,
    unit: product.unitOfMeasure ?? undefined,
    forceAi,
    vddMatches,
    userNote: productContext.userNote,
    context: { text: productContext.text, hints: productContext.hints },
    assumeImportItem: true,
    nameTexts: [product.productName, product.rawDescription],
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
const CLASSIFY_CONCURRENCY = 4;

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
  /** Re-check run only: how many already approved products were sent back to review. */
  resetApproved?: number;
  /** Re-check run only: declaration groups exist and must be built again. */
  groupingStale?: boolean;
};

/** Step 1: choose the products and clear their old suggestions (same as before). */
export async function startClassifyRun(
  caseId: string,
  options?: {
    replaceExisting?: boolean;
    /**
     * Re-check run: only products whose current code fails the plausibility
     * check. Approved ones among them go back to review; good approved items and
     * codes typed by hand are not touched.
     */
    onlySuspicious?: boolean;
    audit?: { tenantId: string; userId: string | null };
  },
): Promise<ClassifyStartInfo> {
  if (options?.onlySuspicious) return startRecheckRun(caseId, options.audit);

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

async function startRecheckRun(
  caseId: string,
  audit?: { tenantId: string; userId: string | null },
): Promise<ClassifyStartInfo> {
  const referencePopulated = await isHsReferenceAvailable();
  const suspicious = (await findSuspiciousProducts(caseId)).filter((s) => !s.manual);
  if (suspicious.length === 0) {
    throw new Error("No suspicious codes found: every code fits its product.");
  }

  const ids = suspicious.map((s) => s.productId);
  const resetApproved = suspicious.filter((s) => s.status === "approved_for_declaration").length;

  await clearProductClassificationData(ids);
  await db
    .update(importProducts)
    .set({ status: "ready_for_hs_suggestion", updatedAt: new Date() })
    .where(inArray(importProducts.id, ids));

  const groupings = await db
    .select({ id: productGroupings.id })
    .from(productGroupings)
    .where(eq(productGroupings.importCaseId, caseId))
    .limit(1);

  if (audit) {
    await writeAuditLog({
      tenantId: audit.tenantId,
      importCaseId: caseId,
      userId: audit.userId,
      entityType: "import_case",
      entityId: caseId,
      action: "classification_recheck_suspicious",
      newData: {
        count: suspicious.length,
        resetApproved,
        previous: suspicious.map((s) => ({
          sequence: s.sequence,
          hsCode: s.hsCode,
          reasons: s.verdict.reasons.slice(0, 2),
        })),
      },
    });
  }

  const eligible = await loadEligibleProducts(caseId, ids);
  return {
    planKey: classifyPlanKey(eligible),
    total: eligible.length,
    sequences: eligible.map((p) => p.productSequence),
    referencePopulated,
    resetApproved,
    groupingStale: groupings.length > 0,
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
  options?: { forceAi?: boolean; scopeSequences?: number[] },
): Promise<ClassifyProductResult[]> {
  const forceAi = options?.forceAi ?? false;
  const eligible = await loadEligibleProducts(caseId, undefined, options?.scopeSequences);
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
  scopeSequences?: number[],
): Promise<ClassifyResult> {
  const eligible = await loadEligibleProducts(caseId, undefined, scopeSequences);
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
  /** The suggested code; null when no real code could be supported (catch-all / excluded). */
  hsCode: string | null;
  source: ProductClassifySource | null;
  needsReview: boolean;
  /** Plain-language reason a human must look closer, e.g. "No clear tariff match". */
  reviewReason: string | null;
  confidenceNote: string | null;
  reasoning: string | null;
  /** Web sources the suggestion relied on (empty when no web search was used). */
  sources: WebSource[];
  /** Code the AI/web proposed that is not in the tariff book (never auto-used). */
  proposedHsCode: string | null;
  webSearchUsed: boolean;
  /** True when the reviewer must choose between `options` / answer `question`. */
  decisionRequired: boolean;
  /** The one question that would settle it. */
  question: string | null;
  /** Ranked, validated options (best first). */
  options: Array<{ hsCode: string; officialDescription: string; reason: string | null }>;
  /** The reviewer's note was part of the context. */
  userNoteUsed: boolean;
};

/** Classify one product, optionally forcing AI instead of tariff reference. */
export async function classifySingleImportProduct(
  caseId: string,
  tenantId: string,
  productId: string,
  userId?: string | null,
  options?: {
    forceAi?: boolean;
    /** Reviewer note: saved with the product, then used as top-priority context. undefined = keep the saved note, "" = clear it. */
    note?: string;
  },
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

  // Save the reviewer's note first, so it also applies to later re-classification.
  let current = product;
  if (options?.note !== undefined) {
    const cleanNote = sanitizeNote(options.note);
    if (cleanNote !== getReviewerNote(product.technicalSpecifications)) {
      current = await saveProductNote(product, cleanNote, userId ?? null);
      await writeAuditLog({
        tenantId,
        importCaseId: caseId,
        userId: userId ?? null,
        entityType: "import_product",
        entityId: productId,
        action: cleanNote ? "classification_note_saved" : "classification_note_cleared",
        newData: { note: cleanNote || null },
      });
    }
  }

  await clearProductClassificationData([product.id]);

  const vddResult = await persistVddMatchesForProduct(tenantId, product);
  const vddMatches: VddScoredMatch[] = vddResult.matches.slice(0, 5);
  const productContext = await loadProductContext(current);

  const result = await classifyProductDescription(description, {
    country: product.countryOfOriginCode ?? undefined,
    unit: product.unitOfMeasure ?? undefined,
    forceAi,
    vddMatches,
    userNote: productContext.userNote,
    context: { text: productContext.text, hints: productContext.hints },
    assumeImportItem: true,
    nameTexts: [product.productName, product.rawDescription],
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
      noteUsed: Boolean(productContext.userNote),
      decisionRequired: result.review?.decisionRequired === true,
    },
  });

  const review = outcome.kind === "skipped" ? undefined : outcome.review;
  const noCode =
    isExcludedHsCode(result.hsCode) || isCatchAllHsCode(result.hsCode);
  return {
    productId,
    hsCode: noCode ? null : result.hsCode,
    source: result.source,
    needsReview: outcome.kind === "needs_review",
    reviewReason: review?.required ? (review.reason ?? null) : null,
    confidenceNote: review?.confidenceNote ?? null,
    reasoning: review?.web.reasoning ?? result.cleanDescription ?? null,
    sources: review?.web.sources ?? [],
    proposedHsCode: review?.proposedCode?.hsCode ?? null,
    webSearchUsed: review?.web.used === true,
    decisionRequired: review?.decisionRequired === true,
    question: review?.question ?? null,
    options: (review?.alternatives ?? []).map((a) => ({
      hsCode: a.hsCode,
      officialDescription: a.officialDescription,
      reason: a.reason ?? null,
    })),
    userNoteUsed: Boolean(productContext.userNote),
  };
}
