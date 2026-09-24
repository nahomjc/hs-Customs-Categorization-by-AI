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

/** Colors / size fluff that often match fabric rows incorrectly (e.g. "plain" → plain weave). */
const SCORE_STOPWORDS = new Set([
  "white",
  "black",
  "blue",
  "red",
  "green",
  "yellow",
  "plain",
  "regular",
  "fit",
  "size",
  "pcs",
  "piece",
  "pieces",
  "pair",
  "pairs",
  "pack",
  "new",
  "item",
  "product",
  "gsm",
]);

/** Strong garment nouns — boost when present in both query and tariff row. */
const APPAREL_TOKEN_RE =
  /^(?:t-?shirts?|shirts?|jeans?|trousers?|pants?|shorts?|skirts?|dresses?|jackets?|coats?|hoodies?|sweaters?|garments?|apparel|clothing|underwear|socks?)$/;

/** Expand query tokens so "jeans" can hit tariff "trousers / breeches". */
const TOKEN_SYNONYMS: Record<string, string[]> = {
  jeans: ["trousers", "breeches", "pants", "denim"],
  jean: ["trousers", "breeches", "pants", "denim"],
  pants: ["trousers", "breeches", "jeans"],
  trousers: ["breeches", "pants", "jeans"],
  shirt: ["shirts", "singlets"],
  shirts: ["shirt", "singlets"],
  "t-shirt": ["t-shirts", "singlets", "vests", "shirts"],
  "t-shirts": ["t-shirt", "singlets", "vests", "shirts"],
  tee: ["t-shirt", "t-shirts", "singlets"],
  hoodie: ["sweatshirt", "pullover", "jersey"],
  sweatshirt: ["hoodie", "pullover", "jersey"],
};

function expandTokens(tokens: string[]): string[] {
  const out = new Set(tokens);
  for (const t of tokens) {
    for (const syn of TOKEN_SYNONYMS[t] ?? []) {
      out.add(syn);
    }
  }
  return [...out];
}

function scoreRow(
  row: HsReferenceCacheRow,
  tokens: string[],
  description: string,
): number {
  const desc = row.description.toLowerCase().replace(/^[-\s]+/, "").trim();
  const expanded = expandTokens(tokens);

  let tokenScore = 0;
  for (const t of expanded) {
    if (SCORE_STOPWORDS.has(t)) continue;
    if (!desc.includes(t)) continue;
    // Original query tokens that are apparel nouns count heavier than synonyms.
    const isOriginal = tokens.includes(t);
    if (APPAREL_TOKEN_RE.test(t) && isOriginal) tokenScore += 3;
    else if (APPAREL_TOKEN_RE.test(t)) tokenScore += 2;
    else tokenScore += isOriginal ? 1 : 0.5;
  }

  // Chapter bonus alone must not pick a random 61/62 row.
  if (tokenScore <= 0) return 0;

  let score = tokenScore;
  const expected = expectedChapters(description);
  if (
    expected &&
    row.chapter &&
    expected.includes(row.chapter.padStart(2, "0").slice(0, 2))
  ) {
    score += 2;
  }

  // Ultra-short official text ("Other") is weak — but a one-word exact
  // product label like "Denim" that appears in the query is a strong hit.
  const meaningfulLen = desc.replace(/[^a-z0-9]/gi, "").length;
  const labelKey = desc.replace(/[^a-z0-9]/gi, "");
  const exactLabelHit = expanded.some(
    (t) => !SCORE_STOPWORDS.has(t) && labelKey === t,
  );
  const weakExactLabels = new Set([
    "unbleached",
    "bleached",
    "printed",
    "dyed",
    "yarn",
    "plain",
    "other",
    "nes",
    "cotton",
    "wool",
    "silk",
  ]);
  if (meaningfulLen > 0 && meaningfulLen < 12 && !exactLabelHit) {
    score -= 2;
  }
  if (/^(?:other|nes|n\.?e\.?s\.?)$/i.test(desc)) {
    score -= 3;
  }
  if (exactLabelHit && !weakExactLabels.has(labelKey)) {
    score += 3;
  }

  const d = description.toLowerCase();
  const ch = (row.chapter ?? "").padStart(2, "0").slice(0, 2);
  // Jeans / denim trousers are almost always woven cotton → prefer ch 62 + cotton.
  if (/\bjeans?\b|denim/.test(d) && !/knit|crochet/.test(d)) {
    if (ch === "62") score += 2;
    if (ch === "61") score -= 1;
    if (/cotton/.test(desc)) score += 2;
    if (/wool|animal\s*hair|synthetic/.test(desc)) score -= 2;
  }
  // Exact "denim" in tariff (fabric or apparel context) is a strong cue.
  if (/\bdenim\b/.test(d) && /\bdenim\b/.test(desc)) {
    score += 3;
  }
  // T-shirts are typically knitted → prefer ch 61.
  if (/t-?\s*shirts?/.test(d) || /\btee\s*shirts?\b/.test(d)) {
    if (ch === "61") score += 2;
    if (ch === "62") score -= 1;
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
