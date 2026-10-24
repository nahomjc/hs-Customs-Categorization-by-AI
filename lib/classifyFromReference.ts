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
  type MatchHints,
} from "./hsReferenceCache";
import { checkPlausibility, shortProductLabel } from "./hs-plausibility";
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
  /** Words the match was made on (the product name, not the long explanation). */
  matchedOn?: string;
};

export function classifyFromReferenceDescription(
  description: string,
  options?: {
    unit?: string;
    /** The supplier's HS code (digits): a hint that ranks its chapter first, never the answer. */
    supplierHsCode?: string | null;
    /** Extra product-name texts that decide the kind of product (name, original wording). */
    nameTexts?: Array<string | null | undefined>;
  },
): (ClassificationResult & { aiRawResponse: string }) | null {
  if (!isReferencePopulated()) return null;

  const desc = cleanProductDescription(description);
  // Match on the product NAME. The long explanation sentence is full of words
  // like "made from" / "used for" that match unrelated tariff rows.
  const label = shortProductLabel(desc) || desc;
  const supplierDigits = (options?.supplierHsCode ?? "").replace(/\D/g, "");
  const hints: MatchHints | undefined =
    supplierDigits.length >= 4
      ? { supplierChapter: supplierDigits.slice(0, 2), supplierHeading: supplierDigits.slice(0, 4) }
      : undefined;
  const match = findBestReferenceMatch(label, 2, hints);
  if (!match) return null;

  if (!isChapterCompatible(label, match.row.chapter) || !isChapterCompatible(desc, match.row.chapter)) {
    return null;
  }

  const hsRaw = match.row.normalizedHs ?? match.row.hsCode;
  if (!hsRaw) return null;

  const normalized = normalizeHsCode(hsRaw);
  if (!normalized) return null;

  // The code must fit the product (chapter / section) and, as a hint, the supplier's code.
  const plausibility = checkPlausibility({
    hsCode: normalized.display,
    texts: [label, ...(options?.nameTexts ?? []), desc],
    supplierHsCode: supplierDigits || null,
  });
  if (plausibility.status === "implausible" || plausibility.status === "check") return null;

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
    matchedOn: label,
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
