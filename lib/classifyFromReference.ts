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
  findInCacheSync,
  getHsReferenceCacheRows,
  isReferencePopulated,
  scoreReferenceRow,
  tokenizeForMatch,
  type MatchHints,
} from "./hsReferenceCache";
import { checkPlausibility, shortProductLabel } from "./hs-plausibility";
import { completeHsCode, hsDigits } from "./hs-code-format";
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
  /**
   * Tariff rows the book cannot tell apart (2 or more, after the invoice-code
   * tie-break): a person must choose, none is picked silently.
   */
  tied?: ReferenceTieRow[];
  /** The invoice code decided between near-equal rows (a hint, confirm it). */
  supplierBreak?: boolean;
  /** The invoice code that was used as a hint (digits). */
  supplierHsCode?: string;
  /** The invoice code was ignored: why (it does not fit the description). */
  supplierIgnored?: string;
  /** Plausible suggestion that differs from the invoice code: both go to a person. */
  supplierCheck?: { reasons: string[]; level?: "chapter" | "heading" | "subheading" };
};

export type ReferenceTieRow = {
  hsCode: string;
  description: string;
  dutyRate?: string;
  stdUnit?: string;
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
  const texts = [label, ...(options?.nameTexts ?? []), desc];
  let supplierDigits = hsDigits(options?.supplierHsCode);
  // The invoice code is only a hint, and it may be wrong: a code that does not fit
  // what the description says is ignored.
  let supplierIgnored: string | undefined;
  if (supplierDigits.length >= 4) {
    const hintVerdict = checkPlausibility({ hsCode: supplierDigits, texts });
    if (hintVerdict.status === "implausible") {
      supplierIgnored = hintVerdict.reasons[0] ?? "It does not fit the product description.";
      supplierDigits = "";
    }
  }
  const hints: MatchHints | undefined =
    supplierDigits.length >= 4
      ? {
          supplierChapter: supplierDigits.slice(0, 2),
          supplierHeading: supplierDigits.slice(0, 4),
          supplierCode: supplierDigits.length >= 6 ? supplierDigits : null,
        }
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

  // Does the description clearly support this row over the invoice code's row?
  let supportsSuggestion = false;
  if (supplierDigits.length >= 4) {
    const done = completeHsCode(supplierDigits, getHsReferenceCacheRows());
    const supplierRow = done.incomplete ? null : findInCacheSync(done.display);
    const ownDigits = hsDigits(hsRaw).slice(0, 8);
    if (supplierRow && hsDigits(supplierRow.normalizedHs ?? supplierRow.hsCode).slice(0, 8) !== ownDigits) {
      const tokens = tokenizeForMatch(label);
      supportsSuggestion =
        scoreReferenceRow(match.row, tokens, label) - scoreReferenceRow(supplierRow, tokens, label) >= 2;
    }
  }

  // The code must fit the product (chapter / section). A plausible code that only
  // differs from the invoice code is kept, but a person decides (see supplierCheck).
  const plausibility = checkPlausibility({
    hsCode: normalized.display,
    texts,
    supplierHsCode: supplierDigits || null,
    descriptionSupportsSuggestion: supportsSuggestion,
  });
  if (plausibility.status === "implausible") return null;

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
  if (supplierDigits) meta.supplierHsCode = supplierDigits;
  if (supplierIgnored) meta.supplierIgnored = supplierIgnored;
  if (match.supplierBreak) meta.supplierBreak = true;
  if (plausibility.status === "check") {
    meta.supplierCheck = { reasons: plausibility.reasons, level: plausibility.level };
  }
  if (match.tied && match.tied.length > 1) {
    meta.tied = match.tied.flatMap((row): ReferenceTieRow[] => {
      const raw = row.normalizedHs ?? row.hsCode;
      const n = raw ? normalizeHsCode(raw) : null;
      if (!n) return [];
      return [
        {
          hsCode: n.display,
          description: row.description.replace(/^[-\s]+/, "").trim(),
          dutyRate: row.dutyRate ?? undefined,
          stdUnit: row.stdUnit ?? undefined,
        },
      ];
    });
  }

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
