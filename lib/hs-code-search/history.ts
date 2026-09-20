import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { hsCodeSearchLogs } from "@/db/schema";
import type { ProductAttributes } from "./schemas";

export type HsCodeSearchHistoryItem = {
  id: string;
  queryText: string;
  resultsCount: number;
  topHsCodeSuggested: string | null;
  topConfidenceScore: number | null;
  extractedAttributes: ProductAttributes | null;
  createdAt: Date;
};

function toAttributes(
  value: unknown,
): ProductAttributes | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as ProductAttributes;
}

export async function getRecentHsCodeSearches(params: {
  tenantId: string;
  userId: string;
  limit?: number;
}): Promise<HsCodeSearchHistoryItem[]> {
  const limit = Math.min(50, Math.max(1, params.limit ?? 10));
  const rows = await db
    .select({
      id: hsCodeSearchLogs.id,
      queryText: hsCodeSearchLogs.queryText,
      resultsCount: hsCodeSearchLogs.resultsCount,
      topHsCodeSuggested: hsCodeSearchLogs.topHsCodeSuggested,
      topConfidenceScore: hsCodeSearchLogs.topConfidenceScore,
      extractedAttributes: hsCodeSearchLogs.extractedAttributes,
      createdAt: hsCodeSearchLogs.createdAt,
    })
    .from(hsCodeSearchLogs)
    .where(
      and(
        eq(hsCodeSearchLogs.tenantId, params.tenantId),
        eq(hsCodeSearchLogs.userId, params.userId),
      ),
    )
    .orderBy(desc(hsCodeSearchLogs.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    queryText: row.queryText,
    resultsCount: row.resultsCount,
    topHsCodeSuggested: row.topHsCodeSuggested,
    topConfidenceScore:
      row.topConfidenceScore != null ? Number(row.topConfidenceScore) : null,
    extractedAttributes: toAttributes(row.extractedAttributes),
    createdAt: row.createdAt,
  }));
}
