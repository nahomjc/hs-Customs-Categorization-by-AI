import { isExcludedHsCode, validateClassification } from "@/lib/allowedHsCodes";
import { applyAssessorRules, classifyByRulesOnly } from "@/lib/assessorRules";
import { classifyItem, type ClassificationResult } from "@/lib/classifyItem";
import {
  classifyFromReferenceDescription,
  type ReferenceClassificationMeta,
} from "@/lib/classifyFromReference";
import { loadHsReferenceCache } from "@/lib/hsReference";
import { isReferencePopulated } from "@/lib/hsReferenceCache";

export type ProductClassifySource =
  | "reference_match"
  | "ai_suggestion"
  | "rule_fallback";

export type ClassifyProductDescriptionResult = ClassificationResult & {
  source: ProductClassifySource;
  aiRawResponse?: string;
  referenceMeta?: ReferenceClassificationMeta;
};

export async function isHsReferenceAvailable(): Promise<boolean> {
  await loadHsReferenceCache();
  return isReferencePopulated();
}

/**
 * Reference-first classification for import-case products.
 * 1. Try hs_code_reference match when table is populated
 * 2. Fall back to OpenRouter AI when no reference match
 * 3. Fall back to rule-based / 9999 when AI unavailable
 */
export async function classifyProductDescription(
  description: string,
  options?: { country?: string; unit?: string; forceAi?: boolean },
): Promise<ClassifyProductDescriptionResult> {
  await loadHsReferenceCache();

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
          confidence: assessed.confidence ?? refResult.confidence ?? 0.9,
          aiRawResponse: refResult.aiRawResponse,
          source: "reference_match",
          referenceMeta,
        };
      }
    }
  }

  try {
    const result = await classifyItem(description, {
      ...options,
      mode: "tariff",
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
            confidence: assessed.confidence ?? refResult.confidence ?? 0.85,
            aiRawResponse: refResult.aiRawResponse,
            source: "reference_match",
            referenceMeta,
          };
        }
      }
    }

    return {
      ...result,
      isImportItem: result.isImportItem !== false,
      source: "ai_suggestion",
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
    };
  }
}
