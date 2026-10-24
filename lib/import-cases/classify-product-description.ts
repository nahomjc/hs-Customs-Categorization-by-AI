import { isExcludedHsCode, validateClassification } from "@/lib/allowedHsCodes";
import { applyAssessorRules, classifyByRulesOnly } from "@/lib/assessorRules";
import { classifyItem, type ClassificationResult } from "@/lib/classifyItem";
import {
  classifyFromReferenceDescription,
  type ReferenceClassificationMeta,
} from "@/lib/classifyFromReference";
import {
  isCatchAllHsCode,
  isWeakReferenceMatch,
} from "@/lib/hs-catch-all";
import { loadHsReferenceCache } from "@/lib/hsReference";
import { isReferencePopulated } from "@/lib/hsReferenceCache";
import type { VddScoredMatch } from "@/lib/vdd/score-match";
import { summarizeVddEvidence } from "@/lib/vdd/search-matches";
import { createStepDeps } from "./hs-web-deps";
import { NO_CLEAR_TARIFF_MATCH } from "@/lib/hs-catch-all";
import { applyWebSearchStep, type SuggestionReview } from "./hs-web-step";
import { gateFirstPass, gateStepResult } from "./plausibility-gate";
import { sanitizeNote, type NameHints } from "./product-context";

export type ProductClassifySource =
  | "reference_match"
  | "ai_suggestion"
  | "rule_fallback"
  | "vdd_consensus";

export type ClassifyProductDescriptionResult = ClassificationResult & {
  source: ProductClassifySource;
  aiRawResponse?: string;
  referenceMeta?: ReferenceClassificationMeta;
  vddEvidence?: ReturnType<typeof summarizeVddEvidence> | null;
  /**
   * Plain-language review info (reason, confidence note, web sources, previous
   * and alternative suggestions). Set for AI suggestions.
   */
  review?: SuggestionReview;
};

function parseReferenceMeta(raw: string): ReferenceClassificationMeta | undefined {
  try {
    return JSON.parse(raw) as ReferenceClassificationMeta;
  } catch {
    return undefined;
  }
}

/**
 * A tariff-book match is only trusted when it is not a catch-all code, scores
 * at least HS_REFERENCE_MIN_SCORE and does not rest on a bare "Other" row.
 * (An assessor-rule override is trusted: a rule, not the weak text score, chose it.)
 */
function isConfidentReference(
  hsCode: string,
  meta: ReferenceClassificationMeta | undefined,
): boolean {
  if (isCatchAllHsCode(hsCode)) return false;
  if (!meta) return true;
  if (meta.assessorOverride) return true;
  return !isWeakReferenceMatch({
    score: meta.score,
    description: meta.referenceDescription,
  });
}

/** Import-case path: never let legacy FORCE_RULES overwrite tariff/AI/VDD. */
const IMPORT_CASE_ASSESSOR_OPTS = { skipForceRules: true } as const;

export async function isHsReferenceAvailable(): Promise<boolean> {
  await loadHsReferenceCache();
  return isReferencePopulated();
}

function isStrongBrandModelMatch(match: VddScoredMatch): boolean {
  return (
    match.similarityScore >= 0.5 &&
    match.matchReasons.some((r) => r.includes("Exact model")) &&
    match.matchReasons.some((r) => r.includes("Exact brand"))
  );
}

/**
 * When brand+model VDD hits agree on one HS, use that as the suggested code
 * (still requires human approval — not a final customs determination).
 */
function strongVddHsConsensus(
  vddMatches: VddScoredMatch[] | undefined,
): { hsCode: string; count: number } | null {
  if (!vddMatches?.length) return null;
  const strong = vddMatches.filter(isStrongBrandModelMatch);
  if (strong.length === 0) return null;

  const counts = new Map<string, number>();
  for (const m of strong) {
    const digits = m.record.hsCode.replace(/\D/g, "");
    if (digits.length < 4) continue;
    // Prefer 6–8 digit form when available; keep original for display
    counts.set(m.record.hsCode, (counts.get(m.record.hsCode) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [hsCode, count] = ranked[0];
  return { hsCode, count };
}

function formatVddHsForSuggestion(hsCode: string): string {
  const digits = hsCode.replace(/\D/g, "");
  if (digits.length >= 6) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}`;
  }
  if (digits.length === 4) return digits;
  return hsCode;
}

/**
 * Slight confidence bump when strong brand+model VDD consensus exists.
 */
function applyVddConfidenceBoost(
  confidence: number | undefined,
  vddMatches: VddScoredMatch[] | undefined,
): number {
  const base = confidence ?? 0.7;
  if (!vddMatches?.length || !isStrongBrandModelMatch(vddMatches[0])) {
    return base;
  }
  return Math.min(0.95, Math.round((base + 0.05) * 10000) / 10000);
}

/**
 * Reference-first classification for import-case products.
 * 1. Strong VDD brand+model HS consensus (suggestion only)
 * 2. hs_code_reference match when table is populated
 * 3. OpenRouter AI with VDD evidence
 * 4. Rule fallback when AI unavailable
 *
 * Legacy FORCE_RULES (assessorRules) are skipped — they must not stamp 9405 on LED bulbs.
 */
export async function classifyProductDescription(
  description: string,
  options?: {
    country?: string;
    unit?: string;
    forceAi?: boolean;
    vddMatches?: VddScoredMatch[];
    /** Reviewer note: highest-priority context; skips the tariff-book shortcut. */
    userNote?: string;
    /** Bounded product / shipment context block (see product-context.ts). */
    context?: { text?: string; hints?: NameHints };
    /**
     * A person already confirmed this is a product: never answer "not an
     * item"; an unsure answer becomes ranked options + a question.
     */
    assumeImportItem?: boolean;
    /** Product name / original wording: they decide what kind of product it is. */
    nameTexts?: Array<string | null | undefined>;
  },
): Promise<ClassifyProductDescriptionResult> {
  await loadHsReferenceCache();

  // A code must fit the product; the supplier's invoice code is only a hint.
  const supplierHsCode = options?.context?.hints?.supplierHsCode ?? null;
  const gateCtx = {
    texts: [...(options?.nameTexts ?? []), description],
    supplierHsCode,
  };
  const referenceOptions = {
    unit: options?.unit ?? undefined,
    supplierHsCode,
    nameTexts: options?.nameTexts,
  };

  const userNote = sanitizeNote(options?.userNote);
  const assumeItem = options?.assumeImportItem === true;

  const vddEvidence =
    options?.vddMatches && options.vddMatches.length > 0
      ? summarizeVddEvidence(options.vddMatches.slice(0, 5))
      : null;
  const vddEvidenceText = vddEvidence?.evidenceText;

  const vddConsensus = strongVddHsConsensus(options?.vddMatches);
  if (vddConsensus && !options?.forceAi && !userNote) {
    const hsCode = formatVddHsForSuggestion(vddConsensus.hsCode);
    if (!isExcludedHsCode(hsCode) && !isCatchAllHsCode(hsCode)) {
      return {
        isImportItem: true,
        hsCode,
        category: "VDD historical consensus",
        cleanDescription: description.trim(),
        confidence: applyVddConfidenceBoost(0.88, options?.vddMatches),
        source: "vdd_consensus",
        aiRawResponse: JSON.stringify({
          source: "vdd_consensus",
          hsCode: vddConsensus.hsCode,
          agreementCount: vddConsensus.count,
          disclaimer:
            "VDD references support review only. They do not determine the final HS code.",
        }),
        vddEvidence,
      };
    }
  }

  let weakReference: { hsCode: string; note?: string } | null = null;

  if (!options?.forceAi && !userNote && isReferencePopulated()) {
    const refResult = classifyFromReferenceDescription(description, referenceOptions);
    if (refResult) {
      const assessed = applyAssessorRules(
        description,
        refResult,
        IMPORT_CASE_ASSESSOR_OPTS,
      );
      const hsCode =
        assessed.isImportItem === false ? "EXCLUDE" : assessed.hsCode;
      const refMeta = parseReferenceMeta(refResult.aiRawResponse);
      const isUsableReference =
        assessed.isImportItem !== false &&
        !isExcludedHsCode(hsCode) &&
        isConfidentReference(hsCode, refMeta);

      if (
        !isUsableReference &&
        assessed.isImportItem !== false &&
        !isExcludedHsCode(hsCode) &&
        !isCatchAllHsCode(hsCode)
      ) {
        // not trusted: shown to the reviewer as an alternative only
        weakReference = {
          hsCode,
          note: `Low-confidence tariff book match${
            refMeta ? ` (score ${refMeta.score})` : ""
          }`,
        };
      }

      if (isUsableReference) {
        const referenceMeta = refMeta;

        return {
          ...assessed,
          hsCode,
          isImportItem: true,
          confidence: applyVddConfidenceBoost(
            assessed.confidence ?? refResult.confidence ?? 0.9,
            options?.vddMatches,
          ),
          aiRawResponse: refResult.aiRawResponse,
          source: "reference_match",
          referenceMeta,
          vddEvidence,
        };
      }
    }
  }

  try {
    const result = await classifyItem(description, {
      country: options?.country,
      unit: options?.unit,
      mode: "tariff",
      vddEvidenceText: vddEvidenceText ?? undefined,
      skipAssessorForceRules: true,
      contextText: options?.context?.text,
      userNote: userNote || undefined,
      assumeImportItem: assumeItem,
      searchHint: options?.context?.hints?.productType,
      supplierHsCode: supplierHsCode ?? undefined,
    });

    const needsSalvage =
      result.isImportItem !== false &&
      (result.hsCode === "9999" ||
        result.hsCode?.startsWith("9999.") ||
        isExcludedHsCode(result.hsCode));

    if (needsSalvage && isReferencePopulated()) {
      const refResult = classifyFromReferenceDescription(description, referenceOptions);
      if (refResult) {
        const assessed = applyAssessorRules(
          description,
          refResult,
          IMPORT_CASE_ASSESSOR_OPTS,
        );
        const hsCode =
          assessed.isImportItem === false ? "EXCLUDE" : assessed.hsCode;
        const salvageMeta = parseReferenceMeta(refResult.aiRawResponse);
        if (
          assessed.isImportItem !== false &&
          !isExcludedHsCode(hsCode) &&
          isConfidentReference(hsCode, salvageMeta)
        ) {
          const referenceMeta = salvageMeta;
          return {
            ...assessed,
            hsCode,
            isImportItem: true,
            confidence: applyVddConfidenceBoost(
              assessed.confidence ?? refResult.confidence ?? 0.85,
              options?.vddMatches,
            ),
            aiRawResponse: refResult.aiRawResponse,
            source: "reference_match",
            referenceMeta,
            vddEvidence,
          };
        }
      }
    }

    // Never accept a catch-all silently: search the web when the tariff book
    // gave no confident match, validate the code against the tariff book and
    // say plainly when a human must look closer.
    // A code that does not fit the product (e.g. food in the vehicle chapters)
    // is not accepted: it becomes the placeholder so the web step and the ranked
    // options take over.
    const gated = gateFirstPass(
      {
        isImportItem: result.isImportItem !== false,
        hsCode: result.hsCode,
        category: result.category,
        cleanDescription: result.cleanDescription,
        confidence: result.confidence,
        noteReference: result.noteReference,
        source: "ai_suggestion",
        options: result.options,
        question: result.question,
      },
      gateCtx,
    );

    const rawStep = await applyWebSearchStep(
      {
        description,
        country: options?.country,
        unit: options?.unit,
        first: gated.first,
        // a reviewer note means "look again properly": always search
        forceAi: options?.forceAi || Boolean(userNote),
        weakReference,
        userNote: userNote || undefined,
        contextText: options?.context?.text,
        hints: options?.context?.hints,
      },
      createStepDeps(),
    );
    const step = gateStepResult(rawStep, gateCtx, gated.rejected);

    return {
      ...result,
      isImportItem: step.isImportItem,
      hsCode: step.hsCode,
      category: step.category,
      cleanDescription: step.cleanDescription,
      noteReference: step.noteReference,
      confidence: applyVddConfidenceBoost(step.confidence, options?.vddMatches),
      source: "ai_suggestion",
      vddEvidence,
      review: step.review,
    };
  } catch (error) {
    const ruleResult = classifyByRulesOnly(description);
    const validated = validateClassification({
      hsCode: ruleResult.hsCode,
      category: ruleResult.category,
      mode: "ai",
    });

    // a confirmed product is never "not an item": it goes to review instead
    const notAnItem = ruleResult.hsCode === "EXCLUDE" || validated.hsCode === "EXCLUDE";
    const keepAsProduct = assumeItem && notAnItem;
    const fallbackHs = keepAsProduct ? "9999" : validated.hsCode;
    const failure = error instanceof Error ? error.message : String(error);
    return {
      isImportItem: keepAsProduct ? true : ruleResult.hsCode !== "EXCLUDE",
      category: keepAsProduct ? "Other" : ruleResult.category,
      hsCode: fallbackHs,
      cleanDescription: ruleResult.cleanDescription,
      confidence: 0.3,
      aiRawResponse: JSON.stringify({ source: "rule_fallback" }),
      source: "rule_fallback",
      vddEvidence,
      ...(assumeItem && isCatchAllHsCode(fallbackHs)
        ? {
            review: {
              required: true,
              reason: `${NO_CLEAR_TARIFF_MATCH}. The AI request failed (${failure.slice(0, 120)}), so only the rule fallback ran. Try Ask AI again.`,
              confidenceNote: "No code suggested",
              userNoteUsed: userNote ? true : undefined,
              alternatives: [],
              web: { attempted: false, used: false, sources: [] },
            } satisfies SuggestionReview,
          }
        : {}),
    };
  }
}
