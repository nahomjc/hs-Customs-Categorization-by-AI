import { db } from "@/db";
import { hsCodeReference, hsCodeSearchLogs } from "@/db/schema";
import {
  getHsReferenceCacheRows,
  isReferencePopulated,
  setHsReferenceCache,
} from "@/lib/hsReferenceCache";
import { extractProductAttributesFromQuery } from "./extract-attributes";
import { rankHsCodeCandidates } from "./rank-candidates";
import { impliedChapters, searchTariffCodes } from "./search-tariff-codes";
import {
  DISCLAIMER,
  HS_CODE_SEARCH_AI_MODEL,
  hsCodeSearchResultSchema,
  productAttributesSchema,
  type HsCodeSearchResult,
  type ProductAttributes,
} from "./schemas";

async function ensureReferenceReady(): Promise<void> {
  if (isReferencePopulated()) return;
  const rows = await db.select().from(hsCodeReference);
  setHsReferenceCache(rows);
}

function withCoverageWarnings(
  attributes: ProductAttributes,
): ProductAttributes {
  const chapters = impliedChapters(attributes);
  if (chapters.length === 0) return attributes;

  const rows = getHsReferenceCacheRows();
  const present = new Set(
    rows
      .map((r) =>
        (r.chapter ?? r.normalizedHs?.slice(0, 2) ?? "")
          .padStart(2, "0")
          .slice(0, 2),
      )
      .filter(Boolean),
  );
  const missingChapters = chapters.filter((c) => !present.has(c));
  if (missingChapters.length === 0) return attributes;

  const warning = `Loaded HS tariff reference appears to lack chapter(s) ${missingChapters.join(", ")}. Upload a fuller tariff book under Dashboard → HS reference for better suggestions.`;
  const missingInformation = [
    ...attributes.missingInformation.filter((m) => m !== warning),
    warning,
  ];
  return { ...attributes, missingInformation };
}

export type RunHsCodeSearchInput = {
  query: string;
  /** Final candidate count (1–5). Default 5. */
  limit?: number;
  /** Deterministic tariff matches before AI ranking. Default 20. */
  tariffMatchLimit?: number;
  /** Skip AI extract and use corrected attributes (UI re-run). */
  attributesOverride?: ProductAttributes;
  /** When set, write a row to hs_code_search_logs. */
  logContext?: {
    tenantId: string;
    userId?: string | null;
  };
};

export async function insertHsCodeSearchLog(params: {
  tenantId: string;
  userId?: string | null;
  queryText: string;
  extractedAttributes: ProductAttributes;
  resultsCount: number;
  topHsCodeSuggested?: string | null;
  topConfidenceScore?: number | null;
  aiModelName?: string;
}): Promise<string> {
  const [row] = await db
    .insert(hsCodeSearchLogs)
    .values({
      tenantId: params.tenantId,
      userId: params.userId ?? null,
      queryText: params.queryText,
      extractedAttributes: params.extractedAttributes,
      resultsCount: params.resultsCount,
      topHsCodeSuggested: params.topHsCodeSuggested ?? null,
      topConfidenceScore:
        params.topConfidenceScore != null
          ? String(params.topConfidenceScore)
          : null,
      aiModelName: params.aiModelName ?? HS_CODE_SEARCH_AI_MODEL,
    })
    .returning({ id: hsCodeSearchLogs.id });

  if (!row) throw new Error("Failed to insert hs_code_search_logs row");
  return row.id;
}

/**
 * Full NLP HS-code search pipeline:
 * extract attributes → deterministic tariff search → AI rank → optional log.
 */
export async function runHsCodeSearch(
  input: RunHsCodeSearchInput,
): Promise<HsCodeSearchResult> {
  const query = input.query.trim();
  if (!query) {
    throw new Error("Query is required");
  }

  const limit = Math.min(5, Math.max(1, input.limit ?? 5));
  const tariffMatchLimit = Math.min(
    50,
    Math.max(5, input.tariffMatchLimit ?? 20),
  );

  await ensureReferenceReady();
  if (!isReferencePopulated()) {
    throw new Error(
      "HS code reference is empty. Upload the tariff book under Dashboard → HS reference before searching.",
    );
  }

  const extractedAttributes = withCoverageWarnings(
    input.attributesOverride
      ? productAttributesSchema.parse(input.attributesOverride)
      : await extractProductAttributesFromQuery(query),
  );

  const tariffMatches = await searchTariffCodes(
    extractedAttributes,
    tariffMatchLimit,
  );

  const ranked = await rankHsCodeCandidates(
    query,
    extractedAttributes,
    tariffMatches,
    limit,
  );

  let searchLogId: string | null = null;
  if (input.logContext?.tenantId) {
    const top = ranked.candidates[0];
    searchLogId = await insertHsCodeSearchLog({
      tenantId: input.logContext.tenantId,
      userId: input.logContext.userId,
      queryText: query,
      extractedAttributes,
      resultsCount: ranked.candidates.length,
      topHsCodeSuggested: top?.hsCode ?? null,
      topConfidenceScore: top?.confidenceScore ?? null,
      aiModelName: ranked.aiModelName,
    });
  }

  return hsCodeSearchResultSchema.parse({
    query,
    productSummary: ranked.productSummary,
    extractedAttributes,
    tariffMatches,
    candidates: ranked.candidates,
    disclaimer: ranked.disclaimer || DISCLAIMER,
    searchLogId,
    aiModelName: ranked.aiModelName,
  });
}
