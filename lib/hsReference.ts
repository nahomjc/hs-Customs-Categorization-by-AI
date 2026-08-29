import "server-only";

import { db } from "@/db";
import { hsCodeReference, type HsCodeReferenceRow } from "@/db/schema";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import {
  formatReferenceCandidate,
  findInCacheSync,
  getHsReferenceCacheRows,
  invalidateHsReferenceCache,
  setHsReferenceCache,
  type HsReferenceCacheRow,
} from "./hsReferenceCache";
import type {
  HsReferenceListParams,
  HsReferenceSortField,
  HsReferenceStats,
} from "./hsReferenceTypes";

export type { HsReferenceListParams, HsReferenceSortField, HsReferenceStats };

const CACHE_TTL_MS = 5 * 60 * 1000;
let cacheLoadedAt = 0;

export { formatReferenceCandidate };

export function invalidateHsReferenceCacheServer(): void {
  invalidateHsReferenceCache();
  cacheLoadedAt = 0;
}

export async function loadHsReferenceCache(force = false): Promise<void> {
  if (
    !force &&
    cacheLoadedAt > 0 &&
    Date.now() - cacheLoadedAt < CACHE_TTL_MS &&
    getHsReferenceCacheRows().length > 0
  ) {
    return;
  }

  const rows = await db.select().from(hsCodeReference);
  setHsReferenceCache(rows);
  cacheLoadedAt = Date.now();
}

export async function getReferenceStats(): Promise<HsReferenceStats> {
  await loadHsReferenceCache();
  const rows = getHsReferenceCacheRows();
  const chapters = [
    ...new Set(rows.map((r) => r.chapter).filter(Boolean) as string[]),
  ].sort();

  const lastImportedAt =
    rows.length > 0
      ? rows.reduce(
          (max, r) => (r.importedAt && r.importedAt > max ? r.importedAt : max),
          rows[0].importedAt ?? "",
        )
      : null;

  const storageBytes = await getHsReferenceStorageBytes();

  return {
    rowCount: rows.length,
    chapters,
    chapterRange:
      chapters.length > 0
        ? `${chapters[0]} – ${chapters[chapters.length - 1]}`
        : null,
    lastImportedAt: lastImportedAt || null,
    storageBytes,
  };
}

export async function findByHsCode(
  code: string,
): Promise<HsReferenceCacheRow | null> {
  await loadHsReferenceCache();
  return findInCacheSync(code);
}

export async function findByTariffNo(
  tariffNo: string,
): Promise<HsReferenceCacheRow | null> {
  await loadHsReferenceCache();
  return findInCacheSync(tariffNo);
}

export async function isInReference(code: string): Promise<boolean> {
  const row = await findByHsCode(code);
  return row !== null;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function scoreRow(row: HsReferenceCacheRow, tokens: string[]): number {
  const desc = row.description.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (desc.includes(t)) score += 1;
  }
  return score;
}

export async function searchDescriptions(
  query: string,
  limit = 40,
): Promise<HsReferenceCacheRow[]> {
  await loadHsReferenceCache();
  const rows = getHsReferenceCacheRows();
  if (rows.length === 0) return [];

  const tokens = tokenize(query);
  if (tokens.length === 0) return rows.slice(0, limit);

  const scored = rows
    .map((row) => ({ row, score: scoreRow(row, tokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.row);
}

export async function searchDescriptionsByKeywords(
  keywords: string[],
  limit = 40,
): Promise<HsReferenceCacheRow[]> {
  const query = keywords.filter(Boolean).join(" ");
  return searchDescriptions(query, limit);
}

export type HsReferenceListResult = {
  rows: HsCodeReferenceRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const SORT_COLUMNS = {
  tariffNo: hsCodeReference.tariffNo,
  hsCode: hsCodeReference.hsCode,
  description: hsCodeReference.description,
  chapter: hsCodeReference.chapter,
  heading: hsCodeReference.heading,
  dutyRate: hsCodeReference.dutyRate,
  importedAt: hsCodeReference.importedAt,
} as const;

function buildReferenceWhere(params: HsReferenceListParams): SQL | undefined {
  const conditions: SQL[] = [];

  const q = params.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    const searchCondition = or(
      ilike(hsCodeReference.description, pattern),
      ilike(hsCodeReference.hsCode, pattern),
      ilike(hsCodeReference.tariffNo, pattern),
      ilike(hsCodeReference.normalizedHs, pattern),
      ilike(hsCodeReference.heading, pattern),
    );
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  const chapter = params.chapter?.trim();
  if (chapter) {
    conditions.push(eq(hsCodeReference.chapter, chapter));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function buildReferenceOrderBy(params: HsReferenceListParams) {
  const sortBy = params.sortBy ?? "tariffNo";
  const column =
    SORT_COLUMNS[sortBy in SORT_COLUMNS ? sortBy : "tariffNo"] ??
    SORT_COLUMNS.tariffNo;
  return params.sortOrder === "desc" ? desc(column) : asc(column);
}

export async function listReferenceDb(
  params: HsReferenceListParams = {},
): Promise<HsReferenceListResult> {
  const pageSize = Math.min(Math.max(params.pageSize ?? 25, 1), 100);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const where = buildReferenceWhere(params);

  const countQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(hsCodeReference);
  const [countRow] = where ? await countQuery.where(where) : await countQuery;

  const total = Number(countRow?.count ?? 0);
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
  const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1;
  const safeOffset = (safePage - 1) * pageSize;

  const rowsQuery = db
    .select()
    .from(hsCodeReference)
    .orderBy(buildReferenceOrderBy(params))
    .limit(pageSize)
    .offset(safeOffset);

  const rows = where ? await rowsQuery.where(where) : await rowsQuery;

  return {
    rows,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

/** @deprecated Use listReferenceDb instead */
export async function searchReferenceDb(
  query: string,
  limit = 50,
): Promise<HsCodeReferenceRow[]> {
  const result = await listReferenceDb({ q: query, pageSize: limit, page: 1 });
  return result.rows;
}

async function getHsReferenceStorageBytes(): Promise<number> {
  const [sizeRow] = await db.execute<{ bytes: string | number }>(sql`
    SELECT pg_total_relation_size('hs_code_reference'::regclass)::bigint AS bytes
  `);
  return Number(sizeRow?.bytes ?? 0);
}

export async function getReferenceStatsFromDb(): Promise<HsReferenceStats> {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(hsCodeReference);

  const chapterRows = await db
    .selectDistinct({ chapter: hsCodeReference.chapter })
    .from(hsCodeReference)
    .where(sql`${hsCodeReference.chapter} is not null`)
    .orderBy(hsCodeReference.chapter);

  const [lastRow] = await db
    .select({ importedAt: hsCodeReference.importedAt })
    .from(hsCodeReference)
    .orderBy(desc(hsCodeReference.importedAt))
    .limit(1);

  const chapters = chapterRows
    .map((r) => r.chapter)
    .filter(Boolean) as string[];

  const storageBytes = await getHsReferenceStorageBytes();

  return {
    rowCount: Number(countRow?.count ?? 0),
    chapters,
    chapterRange:
      chapters.length > 0
        ? `${chapters[0]} – ${chapters[chapters.length - 1]}`
        : null,
    lastImportedAt: lastRow?.importedAt ?? null,
    storageBytes,
  };
}
