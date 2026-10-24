/**
 * Check an HS code proposed by the AI (or the web) against the tariff book
 * (`hs_code_reference`, loaded in the in-memory cache). Never invents a code:
 * the result is either a code that exists in the book, a clearly flagged
 * "mapped" code that exists in the book, or "unresolved".
 *
 * Pure module (uses the client-safe cache only), so it is testable offline.
 */

import { isPlaceholderHsCode } from "./hs-catch-all";
import { isHsCodeFormat, normalizeHsCode } from "./hsCodeUtils";
import {
  findInCacheSync,
  getHsReferenceCacheRows,
  isReferencePopulated,
  type HsReferenceCacheRow,
} from "./hsReferenceCache";

export type ReferenceResolution =
  | {
      /** The code exists in the tariff book exactly as proposed. */
      status: "exact";
      hsCode: string;
      row: HsReferenceCacheRow;
      requestedCode: string;
    }
  | {
      /**
       * The exact national code is missing; this is the closest code that DOES
       * exist in the book under the same 6-digit subheading.
       */
      status: "mapped";
      hsCode: string;
      row: HsReferenceCacheRow;
      requestedCode: string;
      /** True when several rows were equally plausible (needs a human pick). */
      ambiguous: boolean;
      /** Other real codes under the same subheading, best first. */
      siblings: HsReferenceCacheRow[];
    }
  | {
      /** The tariff book is empty: format is valid but nothing could be verified. */
      status: "unverified";
      hsCode: string;
      requestedCode: string;
    }
  | {
      /** Placeholder, bad format, or no row under that subheading in the book. */
      status: "unresolved";
      requestedCode: string;
      reason: "placeholder" | "bad_format" | "not_in_tariff_book";
    };

function rowCode(row: HsReferenceCacheRow): string {
  return row.normalizedHs ?? row.hsCode ?? row.tariffNo;
}

function rowDigits(row: HsReferenceCacheRow): string {
  return (row.normalizedHs ?? row.hsCode ?? "").replace(/\D/g, "");
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function overlapScore(row: HsReferenceCacheRow, hint: string): number {
  const rowText = row.description.toLowerCase();
  const seen = new Set<string>();
  let score = 0;
  for (const t of tokens(hint)) {
    if (seen.has(t)) continue;
    seen.add(t);
    if (rowText.includes(t)) score++;
  }
  return score;
}

/**
 * @param code proposed HS code (any common format)
 * @param hint product description (+ reasoning) used only to choose between
 *             several real codes under the same subheading
 */
export function resolveAgainstReference(
  code: string | null | undefined,
  hint = "",
): ReferenceResolution {
  const requestedCode = (code ?? "").trim();
  if (requestedCode && !/\d/.test(requestedCode) && !/^(exclude|need_info)$/i.test(requestedCode)) {
    return { status: "unresolved", requestedCode, reason: "bad_format" };
  }
  if (isPlaceholderHsCode(requestedCode)) {
    return { status: "unresolved", requestedCode, reason: "placeholder" };
  }
  const normalized = normalizeHsCode(requestedCode);
  if (!normalized || !isHsCodeFormat(requestedCode)) {
    return { status: "unresolved", requestedCode, reason: "bad_format" };
  }

  if (!isReferencePopulated()) {
    return {
      status: "unverified",
      hsCode: normalized.display,
      requestedCode,
    };
  }

  const exact = findInCacheSync(requestedCode);
  if (exact && rowDigits(exact).length >= normalized.display.replace(/\D/g, "").length) {
    return { status: "exact", hsCode: rowCode(exact), row: exact, requestedCode };
  }

  // Need at least a 6-digit subheading to map; a bare heading is too vague.
  const requestedDigits = requestedCode.replace(/\D/g, "");
  if (requestedDigits.length < 6) {
    if (exact) {
      return { status: "exact", hsCode: rowCode(exact), row: exact, requestedCode };
    }
    return { status: "unresolved", requestedCode, reason: "not_in_tariff_book" };
  }

  const prefix = requestedDigits.slice(0, 6);
  const siblings = getHsReferenceCacheRows().filter((row) => {
    const d = rowDigits(row);
    return d.length >= 6 && d.startsWith(prefix);
  });
  if (siblings.length === 0) {
    return { status: "unresolved", requestedCode, reason: "not_in_tariff_book" };
  }

  const ranked = siblings
    .map((row) => ({ row, score: overlapScore(row, hint) }))
    .sort(
      (a, b) =>
        b.score - a.score || rowDigits(a.row).localeCompare(rowDigits(b.row)),
    );
  const best = ranked[0];
  const ambiguous =
    siblings.length > 1 && (best.score === 0 || ranked[1].score === best.score);

  return {
    status: "mapped",
    hsCode: rowCode(best.row),
    row: best.row,
    requestedCode,
    ambiguous,
    siblings: ranked.slice(1).map((r) => r.row),
  };
}