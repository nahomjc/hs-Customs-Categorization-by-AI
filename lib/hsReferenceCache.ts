import { normalizeHsCode } from "./hsCodeUtils";
import { tariffNoToHs } from "./importHsTariffBook";
import {
  expectedChapters,
  isChapterCompatible,
} from "./hsProductChapter";

/** Minimal row shape for in-memory HS reference lookup (client-safe). */
export type HsReferenceCacheRow = {
  id?: string;
  heading: string | null;
  hsCode: string | null;
  tariffNo: string;
  description: string;
  stdUnit: string | null;
  dutyRate: string | null;
  chapter: string | null;
  normalizedHs: string | null;
  importedAt?: string;
};

type HsReferenceCache = {
  rows: HsReferenceCacheRow[];
  byHs: Map<string, HsReferenceCacheRow>;
  byNormalizedHs: Map<string, HsReferenceCacheRow>;
  byTariffNo: Map<string, HsReferenceCacheRow>;
  loadedAt: number;
};

let cache: HsReferenceCache | null = null;

function indexKey(code: string): string {
  return code.trim().toLowerCase();
}

function buildCache(rows: HsReferenceCacheRow[]): HsReferenceCache {
  const byHs = new Map<string, HsReferenceCacheRow>();
  const byNormalizedHs = new Map<string, HsReferenceCacheRow>();
  const byTariffNo = new Map<string, HsReferenceCacheRow>();

  for (const row of rows) {
    if (row.hsCode) byHs.set(indexKey(row.hsCode), row);
    if (row.normalizedHs) byNormalizedHs.set(indexKey(row.normalizedHs), row);
    byTariffNo.set(indexKey(row.tariffNo), row);
  }

  return {
    rows,
    byHs,
    byNormalizedHs,
    byTariffNo,
    loadedAt: Date.now(),
  };
}

function lookupInCache(
  code: string,
  c: HsReferenceCache,
): HsReferenceCacheRow | null {
  const key = indexKey(code);
  const fromNormalized = c.byNormalizedHs.get(key);
  if (fromNormalized) return fromNormalized;
  const fromHs = c.byHs.get(key);
  if (fromHs) return fromHs;
  const fromTariffNo = c.byTariffNo.get(key);
  if (fromTariffNo) return fromTariffNo;

  const n = normalizeHsCode(code);
  if (n) {
    const nk = indexKey(n.display);
    const fromNorm2 = c.byNormalizedHs.get(nk);
    if (fromNorm2) return fromNorm2;
    const fromHs2 = c.byHs.get(nk);
    if (fromHs2) return fromHs2;
  }

  const fromTariff = tariffNoToHs(code);
  if (fromTariff) {
    const tk = indexKey(fromTariff);
    const fromNorm3 = c.byNormalizedHs.get(tk);
    if (fromNorm3) return fromNorm3;
  }

  return null;
}

export function invalidateHsReferenceCache(): void {
  cache = null;
}

export function setHsReferenceCache(rows: HsReferenceCacheRow[]): void {
  cache = buildCache(rows);
}

export function isReferencePopulated(): boolean {
  return cache !== null && cache.rows.length > 0;
}

export function getHsReferenceCacheRows(): HsReferenceCacheRow[] {
  return cache?.rows ?? [];
}

/** Sync lookup when cache is already loaded (e.g. during classification batch). */
export function findInCacheSync(code: string): HsReferenceCacheRow | null {
  if (!cache || cache.rows.length === 0) return null;
  return lookupInCache(code, cache);
}

/**
 * Exact HS lookup, then heading/prefix fallback (e.g. 9405 → 9405.10.00 row).
 * Prefers rows that have a duty rate and more specific HS codes.
 */
export function findReferenceForHsCode(code: string): HsReferenceCacheRow | null {
  if (!cache || cache.rows.length === 0) return null;

  const exact = lookupInCache(code, cache);
  if (exact?.dutyRate) return exact;

  const n = normalizeHsCode(code);
  const heading = n?.heading ?? code.replace(/\D/g, "").slice(0, 4);
  if (heading.length < 4) return exact;

  let bestWithDuty: HsReferenceCacheRow | null =
    exact?.dutyRate ? exact : null;
  let bestAny: HsReferenceCacheRow | null = exact;

  for (const row of cache.rows) {
    const rowHs = (row.normalizedHs ?? row.hsCode ?? "").replace(/\s/g, "");
    const rowHeading =
      row.heading ?? rowHs.replace(/\D/g, "").slice(0, 4);

    const matches =
      rowHeading === heading ||
      rowHs.startsWith(heading) ||
      rowHs.replace(/\D/g, "").startsWith(heading);

    if (!matches) continue;

    if (row.dutyRate) {
      const rowLen = rowHs.length;
      const bestLen = (
        bestWithDuty?.normalizedHs ??
        bestWithDuty?.hsCode ??
        ""
      ).length;
      if (!bestWithDuty || rowLen >= bestLen) bestWithDuty = row;
    }
    if (!bestAny) bestAny = row;
  }

  return bestWithDuty ?? bestAny ?? exact;
}

export function formatReferenceCandidate(row: HsReferenceCacheRow): string {
  const code = row.normalizedHs ?? row.hsCode ?? row.tariffNo;
  const snippet = row.description.replace(/\s+/g, " ").slice(0, 80);
  return `${code} (${row.tariffNo}): ${snippet}`;
}

export type ReferenceMatch = {
  row: HsReferenceCacheRow;
  score: number;
};

export type ReferenceEnrichableRow = {
  description: string;
  sourceHsCode: string | null;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function scoreRow(row: HsReferenceCacheRow, tokens: string[], description: string): number {
  const desc = row.description.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (desc.includes(t)) score += 1;
  }
  const expected = expectedChapters(description);
  if (expected && row.chapter && expected.includes(row.chapter.padStart(2, "0").slice(0, 2))) {
    score += 2;
  }
  return score;
}

/** Best tariff-book match for a product description (sync, uses loaded cache). */
export function findBestReferenceMatch(
  description: string,
  minScore = 2,
): ReferenceMatch | null {
  if (!cache || cache.rows.length === 0) return null;

  const tokens = tokenize(description);
  if (tokens.length === 0) return null;

  let best: ReferenceMatch | null = null;
  for (const row of cache.rows) {
    if (!isChapterCompatible(description, row.chapter)) continue;

    const score = scoreRow(row, tokens, description);
    if (score < minScore) continue;
    if (!best || score > best.score) {
      best = { row, score };
    }
  }
  return best;
}

/** Fill missing source HS from tariff reference when description matches. */
export function enrichParsedRowFromReference<T extends ReferenceEnrichableRow>(
  row: T,
): T {
  if (!isReferencePopulated()) return row;
  if (row.sourceHsCode?.trim()) return row;

  const match = findBestReferenceMatch(row.description);
  if (!match) return row;

  const hs = match.row.normalizedHs ?? match.row.hsCode;
  if (!hs) return row;

  return { ...row, sourceHsCode: hs };
}
