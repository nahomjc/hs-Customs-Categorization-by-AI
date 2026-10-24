/**
 * Catch-all / placeholder HS codes and weak tariff-book matches.
 *
 * Why this exists: a code such as 9999 ("Other / unclassified") used to be
 * accepted like any other answer and could even be approved. A catch-all is
 * never a real classification, so it must go to review, not be counted as done.
 *
 * RULES (kept deliberately small and documented)
 *
 * 1. A code is a PLACEHOLDER (always a catch-all) when it is:
 *    - empty, "9999", "9999.xx", "0000", "0000.xx", "EXCLUDE" or "NEED_INFO"
 *    - in chapter 98 or 99 (national / special use, never a product code)
 * 2. A code is a HEADING-LEVEL catch-all when it has only 2 or 4 digits (no
 *    subheading) AND the tariff book describes it only as "Other", "Others"
 *    or "n.e.s.". Such a row says nothing about the product.
 * 3. A subheading row (6+ digits) whose description is "Other" is NOT a
 *    catch-all. In the tariff book "Other" under a real heading, for example
 *    2202.99 "Other" (non-alcoholic beverages), is a legitimate code.
 * 4. A tariff-book MATCH is WEAK (not trusted without AI / review) when its
 *    score is below HS_REFERENCE_MIN_SCORE (default 3) or the matched row's
 *    description is only "Other" / "nes".
 *
 * Pure module: no database, no server-only imports.
 */

import type { HsReferenceCacheRow } from "./hsReferenceCache";

/** Default minimum score for a tariff-book match to be trusted. */
export const DEFAULT_REFERENCE_MIN_SCORE = 3;

export function getReferenceMinScore(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = Number.parseFloat(env.HS_REFERENCE_MIN_SCORE ?? "");
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_REFERENCE_MIN_SCORE;
}

const BARE_OTHER_RE = /^(?:other|others|nes|n\.?\s?e\.?\s?s\.?|not elsewhere specified)$/i;

/** True when a tariff description is only "Other" / "Others" / "nes" (dashes allowed). */
export function isBareOtherDescription(
  description: string | null | undefined,
): boolean {
  const cleaned = (description ?? "")
    .replace(/^[\s\-–—]+/, "")
    .replace(/[\s.:;,]+$/, "")
    .trim();
  return cleaned.length > 0 && BARE_OTHER_RE.test(cleaned);
}

function digitsOf(code: string | null | undefined): string {
  return (code ?? "").replace(/\D/g, "");
}

/** Codes that never describe a product: 9999, 0000, EXCLUDE, NEED_INFO, chapters 98/99. */
export function isPlaceholderHsCode(code: string | null | undefined): boolean {
  const raw = (code ?? "").trim();
  if (!raw) return true;
  const upper = raw.toUpperCase();
  if (upper === "EXCLUDE" || upper === "NEED_INFO") return true;
  const digits = digitsOf(raw);
  if (!digits) return true;
  if (digits.startsWith("9999") || digits.startsWith("0000")) return true;
  const chapter = digits.slice(0, 2);
  return chapter === "98" || chapter === "99";
}

/**
 * Catch-all check (rules 1-3 above). Pass the tariff-book row when you have it
 * so heading-level "Other" rows can be recognised.
 */
export function isCatchAllHsCode(
  code: string | null | undefined,
  referenceRow?: Pick<HsReferenceCacheRow, "description"> | null,
): boolean {
  if (isPlaceholderHsCode(code)) return true;
  const digits = digitsOf(code);
  if (digits.length <= 4 && referenceRow) {
    return isBareOtherDescription(referenceRow.description);
  }
  return false;
}

/** Weak tariff-book match (rule 4). */
export function isWeakReferenceMatch(
  match: { score: number; description?: string | null },
  minScore: number = getReferenceMinScore(),
): boolean {
  if (match.score < minScore) return true;
  return isBareOtherDescription(match.description);
}

/**
 * Why a code may not be approved (null = fine to approve).
 * - A placeholder (9999, 0000, EXCLUDE ...) is never approvable. A code the
 *   reviewer typed by hand is only blocked for 9999 / 0000 / empty.
 * - A heading-level "Other" row is blocked unless the reviewer typed the code.
 */
export function approvalBlockReason(
  hsCode: string | null | undefined,
  options: {
    manual: boolean;
    referenceRow?: Pick<HsReferenceCacheRow, "description"> | null;
  },
): string | null {
  const digits = digitsOf(hsCode);
  const placeholder = options.manual
    ? digits === "" || /^(9999|0000)/.test(digits)
    : isPlaceholderHsCode(hsCode);
  if (placeholder) {
    return "This is a placeholder (no tariff code was found), not a real HS code. Set the code by hand first.";
  }
  if (!options.manual && isCatchAllHsCode(hsCode, options.referenceRow)) {
    return 'This code is only a catch-all heading ("Other"). Set a specific HS code by hand first.';
  }
  return null;
}

/** Plain-language reason shown to the reviewer for a catch-all result. */
export const NO_CLEAR_TARIFF_MATCH = "No clear tariff match";