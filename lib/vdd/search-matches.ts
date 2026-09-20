import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { vddReferenceRecords } from "@/db/schema";
import { scoreVddMatch, type VddScoredMatch } from "./score-match";
import type { VddSearchProfile } from "./search-profile";

const DEFAULT_CANDIDATE_POOL = 200;
const DEFAULT_LIMIT = 20;
const MIN_SCORE_TO_RETURN = 0.1;

/**
 * Search tenant VDD reference records and rank by deterministic similarity.
 */
export async function searchVddMatches(
  tenantId: string,
  profile: VddSearchProfile,
  limit = DEFAULT_LIMIT,
): Promise<VddScoredMatch[]> {
  const filters = [eq(vddReferenceRecords.tenantId, tenantId)];
  const orParts = [];

  if (profile.brand) {
    orParts.push(ilike(vddReferenceRecords.brandOrMake, profile.brand));
  }
  if (profile.model) {
    orParts.push(ilike(vddReferenceRecords.model, profile.model));
  }
  if (profile.productName) {
    orParts.push(
      ilike(vddReferenceRecords.commonName, `%${profile.productName}%`),
    );
  }
  if (profile.description) {
    const tokens = profile.description
      .split(/\s+/)
      .filter((t) => t.length > 3)
      .slice(0, 4);
    for (const token of tokens) {
      orParts.push(
        ilike(vddReferenceRecords.commercialDescription, `%${token}%`),
      );
      orParts.push(ilike(vddReferenceRecords.commonName, `%${token}%`));
    }
  }

  const whereClause =
    orParts.length > 0 ? and(...filters, or(...orParts)) : and(...filters);

  let candidates = await db
    .select()
    .from(vddReferenceRecords)
    .where(whereClause)
    .limit(DEFAULT_CANDIDATE_POOL);

  // Fallback: if brand/model prefilter returned nothing, sample recent tenant rows
  if (candidates.length === 0 && (profile.brand || profile.model || profile.description)) {
    candidates = await db
      .select()
      .from(vddReferenceRecords)
      .where(eq(vddReferenceRecords.tenantId, tenantId))
      .orderBy(sql`${vddReferenceRecords.createdAt} desc`)
      .limit(DEFAULT_CANDIDATE_POOL);
  }

  const scored = candidates
    .map((record) => scoreVddMatch(profile, record))
    .filter((m) => m.similarityScore >= MIN_SCORE_TO_RETURN)
    .sort((a, b) => b.similarityScore - a.similarityScore || b.points - a.points);

  // Dedupe by record id (already unique) and take top N
  return scored.slice(0, limit);
}

export function buildPriceComparison(
  profile: VddSearchProfile,
  matches: VddScoredMatch[],
): {
  currentUnitPrice: number | null;
  low: number | null;
  high: number | null;
  average: number | null;
  currency: string | null;
  unit: string | null;
  recordCount: number;
} | null {
  const prices = matches
    .map((m) =>
      m.record.declaredUnitPrice != null
        ? Number(m.record.declaredUnitPrice)
        : null,
    )
    .filter((n): n is number => n != null && !Number.isNaN(n));

  if (prices.length === 0) return null;

  const sum = prices.reduce((a, b) => a + b, 0);
  return {
    currentUnitPrice: profile.unitPrice,
    low: Math.min(...prices),
    high: Math.max(...prices),
    average: Math.round((sum / prices.length) * 10000) / 10000,
    currency: matches[0]?.record.currencyCode ?? "USD",
    unit: matches[0]?.record.unitOfQuantity ?? profile.unitOfMeasure,
    recordCount: prices.length,
  };
}

export function summarizeVddEvidence(matches: VddScoredMatch[]): {
  similarRecordsUsed: number;
  matchingAttributes: string[];
  differentAttributes: string[];
  hsCodeConsensus: Array<{ hsCode: string; count: number }>;
  evidenceText: string;
} {
  const matchingAttributes = [
    ...new Set(matches.flatMap((m) => m.matchReasons)),
  ];
  const differentAttributes = [
    ...new Set(matches.flatMap((m) => m.differences)),
  ];

  const hsCounts = new Map<string, number>();
  for (const m of matches) {
    hsCounts.set(m.record.hsCode, (hsCounts.get(m.record.hsCode) ?? 0) + 1);
  }
  const hsCodeConsensus = [...hsCounts.entries()]
    .map(([hsCode, count]) => ({ hsCode, count }))
    .sort((a, b) => b.count - a.count);

  const lines = matches.slice(0, 5).map((m, i) => {
    const r = m.record;
    return `${i + 1}. HS ${r.hsCode} | ${r.brandOrMake ?? "—"} ${r.model ?? ""} | ${r.commonName ?? r.commercialDescription ?? "—"} | similarity ${(m.similarityScore * 100).toFixed(0)}% | reasons: ${m.matchReasons.join(", ") || "none"}`;
  });

  const consensus =
    hsCodeConsensus.length > 0
      ? `Historical HS consensus: ${hsCodeConsensus
          .slice(0, 3)
          .map((h) => `${h.hsCode} (${h.count})`)
          .join(", ")}.`
      : "No HS consensus from VDD matches.";

  const evidenceText = [
    "VDD historical references (decision support only — do NOT auto-copy HS codes or prices):",
    consensus,
    ...lines,
  ].join("\n");

  return {
    similarRecordsUsed: matches.length,
    matchingAttributes,
    differentAttributes,
    hsCodeConsensus,
    evidenceText,
  };
}
