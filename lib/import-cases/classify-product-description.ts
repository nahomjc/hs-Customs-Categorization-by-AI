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
  | "rule_fallback";

export type ClassifyProductDescriptionResult = ClassificationResult & {
  source: ProductClassifySource;
  aiRawResponse?: string;
  referenceMeta?: ReferenceClassificationMeta;
  vddEvidence?: ReturnType<typeof summarizeVddEvidence> | null;
};

export async function isHsReferenceAvailable(): Promise<boolean> {
  await loadHsReferenceCache();
  return isReferencePopulated();
}

/**
 * Slight confidence bump when strong brand+model VDD consensus exists.
 * Never sets HS from VDD alone.
 */
function applyVddConfidenceBoost(
  confidence: number | undefined,
  vddMatches: VddScoredMatch[] | undefined,
): number {
  const base = confidence ?? 0.7;
  if (!vddMatches?.length) return base;
  const top = vddMatches[0];
  const strong =
    top.similarityScore >= 0.5 &&
    top.matchReasons.some((r) => r.includes("Exact model")) &&
    top.matchReasons.some((r) => r.includes("Exact brand"));
  if (!strong) return base;
  return Math.min(0.95, Math.round((base + 0.05) * 10000) / 10000);
}

/**
 * Reference-first classification for import-case products.
 * 1. Try hs_code_reference match when table is populated
 * 2. Fall back to OpenRouter AI when no reference match (with optional VDD evidence)
 * 3. Fall back to rule-based / 9999 when AI unavailable
 *
 * VDD matches are decision-support evidence only — never auto-copied as HS.
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

  if (!options?.forceAi && isReferencePopulated()) {
    const refResult = classifyFromReferenceDescription(description, {
      unit: options?.unit ?? undefined,
    });
    if (refResult) {
      const assessed = applyAssessorRules(description, refResult);
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
        const assessed = applyAssessorRules(description, refResult);
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
