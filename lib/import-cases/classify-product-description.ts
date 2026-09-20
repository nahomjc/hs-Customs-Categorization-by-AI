import { isExcludedHsCode, validateClassification } from "@/lib/allowedHsCodes";
import { applyAssessorRules, classifyByRulesOnly } from "@/lib/assessorRules";
import { classifyItem, type ClassificationResult } from "@/lib/classifyItem";
import {
  classifyFromReferenceDescription,
  type ReferenceClassificationMeta,
} from "@/lib/classifyFromReference";
import { loadHsReferenceCache } from "@/lib/hsReference";
import { isReferencePopulated } from "@/lib/hsReferenceCache";
import type { VddScoredMatch } from "@/lib/vdd/score-match";
import { summarizeVddEvidence } from "@/lib/vdd/search-matches";

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
};

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
  },
): Promise<ClassifyProductDescriptionResult> {
  await loadHsReferenceCache();

  const vddEvidence =
    options?.vddMatches && options.vddMatches.length > 0
      ? summarizeVddEvidence(options.vddMatches.slice(0, 5))
      : null;
  const vddEvidenceText = vddEvidence?.evidenceText;

  const vddConsensus = strongVddHsConsensus(options?.vddMatches);
  if (vddConsensus && !options?.forceAi) {
    const hsCode = formatVddHsForSuggestion(vddConsensus.hsCode);
    if (!isExcludedHsCode(hsCode)) {
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

  if (!options?.forceAi && isReferencePopulated()) {
    const refResult = classifyFromReferenceDescription(description, {
      unit: options?.unit ?? undefined,
    });
    if (refResult) {
      const assessed = applyAssessorRules(
        description,
        refResult,
        IMPORT_CASE_ASSESSOR_OPTS,
      );
      const hsCode =
        assessed.isImportItem === false ? "EXCLUDE" : assessed.hsCode;
      const isUsableReference =
        assessed.isImportItem !== false && !isExcludedHsCode(hsCode);

      if (isUsableReference) {
        let referenceMeta: ReferenceClassificationMeta | undefined;
        try {
          referenceMeta = JSON.parse(
            refResult.aiRawResponse,
          ) as ReferenceClassificationMeta;
        } catch {
          referenceMeta = undefined;
        }

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
    });

    const needsSalvage =
      result.isImportItem !== false &&
      (result.hsCode === "9999" ||
        result.hsCode?.startsWith("9999.") ||
        isExcludedHsCode(result.hsCode));

    if (needsSalvage && isReferencePopulated()) {
      const refResult = classifyFromReferenceDescription(description, {
        unit: options?.unit ?? undefined,
      });
      if (refResult) {
        const assessed = applyAssessorRules(
          description,
          refResult,
          IMPORT_CASE_ASSESSOR_OPTS,
        );
        const hsCode =
          assessed.isImportItem === false ? "EXCLUDE" : assessed.hsCode;
        if (assessed.isImportItem !== false && !isExcludedHsCode(hsCode)) {
          let referenceMeta: ReferenceClassificationMeta | undefined;
          try {
            referenceMeta = JSON.parse(
              refResult.aiRawResponse,
            ) as ReferenceClassificationMeta;
          } catch {
            referenceMeta = undefined;
          }
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

    return {
      ...result,
      isImportItem: result.isImportItem !== false,
      confidence: applyVddConfidenceBoost(result.confidence, options?.vddMatches),
      source: "ai_suggestion",
      vddEvidence,
    };
  } catch {
    const ruleResult = classifyByRulesOnly(description);
    const validated = validateClassification({
      hsCode: ruleResult.hsCode,
      category: ruleResult.category,
      mode: "ai",
    });

    return {
      isImportItem: ruleResult.hsCode !== "EXCLUDE",
      category: ruleResult.category,
      hsCode: validated.hsCode,
      cleanDescription: ruleResult.cleanDescription,
      confidence: 0.3,
      aiRawResponse: JSON.stringify({ source: "rule_fallback" }),
      source: "rule_fallback",
      vddEvidence,
    };
  }
}
