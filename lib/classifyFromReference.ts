import { validateClassification } from "./allowedHsCodes";
import { applyAssessorRules } from "./assessorRules";
import { categoryFromHs } from "./hsCategories";
import {
  chapterCompatibilityReasons,
  isChapterCompatible,
} from "./hsProductChapter";
import { cleanProductDescription } from "./packingListFilters";
import { normalizeHsCode } from "./hsCodeUtils";
import {
  findBestReferenceMatch,
  isReferencePopulated,
} from "./hsReferenceCache";
import type { ClassificationResult } from "./classifyItem";

export type ReferenceClassificationMeta = {
  source: "reference";
  score: number;
  tariffNo: string;
  normalizedHs: string;
  dutyRate?: string;
  stdUnit?: string;
  referenceDescription: string;
  assessorOverride?: boolean;
  compatibilityRejected?: boolean;
};

export function classifyFromReferenceDescription(
  description: string,
  options?: { unit?: string },
): (ClassificationResult & { aiRawResponse: string }) | null {
  if (!isReferencePopulated()) return null;

  const desc = cleanProductDescription(description);
  const match = findBestReferenceMatch(desc);
  if (!match) return null;

  if (!isChapterCompatible(desc, match.row.chapter)) {
    return null;
  }

  const hsRaw = match.row.normalizedHs ?? match.row.hsCode;
  if (!hsRaw) return null;

  const normalized = normalizeHsCode(hsRaw);
  if (!normalized) return null;

  const category = categoryFromHs(normalized, desc);

  const official = match.row.description.replace(/^[-\s]+/, "").trim();
  const cleanDescription =
    official &&
    (desc.length < 12 || desc.toLowerCase() === "unspecified item")
      ? official
      : desc;

  let result: ClassificationResult = {
    isImportItem: true,
    category,
    hsCode: normalized.display,
    cleanDescription,
    confidence: Math.min(0.95, 0.7 + match.score * 0.05),
  };

  const beforeHs = result.hsCode;
  result = applyAssessorRules(desc, result);
  const assessorOverride = result.hsCode !== beforeHs;

  const validated = validateClassification({
    hsCode: result.hsCode,
    category: result.category,
  });
  result.hsCode = validated.hsCode;

  const meta: ReferenceClassificationMeta = {
    source: "reference",
    score: match.score,
    tariffNo: match.row.tariffNo,
    normalizedHs: normalized.display,
    dutyRate: match.row.dutyRate ?? undefined,
    stdUnit: match.row.stdUnit ?? options?.unit ?? undefined,
    referenceDescription: match.row.description,
    assessorOverride,
  };

  const compatReasons = chapterCompatibilityReasons(desc, match.row.chapter);
  if (compatReasons.length > 0) {
    meta.compatibilityRejected = false;
  }

  return {
    ...result,
    category: result.category,
    confidence: result.confidence,
    aiRawResponse: JSON.stringify(meta),
  };
}
