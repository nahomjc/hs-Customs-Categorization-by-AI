import { db } from "@/db";
import {
  importCases,
  importProducts,
  productClassifications,
} from "@/db/schema";
import type { OutcomeDayRow } from "@/lib/dashboard-bento-utils";
import type { StatusCount } from "@/lib/dashboard-analytics-utils";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

const IN_PROGRESS_STATUSES = [
  "draft",
  "documents_uploaded",
  "extraction_in_progress",
  "needs_information",
  "ready_for_classification",
  "classification_in_review",
  "ready_for_declaration",
];

export type ImportCasesAnalyticsData = {
  totalCount: number;
  completedCount: number;
  inProgressCount: number;
  cancelledCount: number;
  statusBreakdown: StatusCount[];
  casesByDay: { day: string; count: number }[];
  recentInRange: {
    id: string;
    caseNumber: string;
    importerName: string | null;
    supplierName: string | null;
    status: string | null;
    createdAt: Date | null;
    invoiceTotalAmount: string | null;
    invoiceCurrencyCode: string | null;
  }[];
};

const EMPTY: ImportCasesAnalyticsData = {
  totalCount: 0,
  completedCount: 0,
  inProgressCount: 0,
  cancelledCount: 0,
  statusBreakdown: [],
  casesByDay: [],
  recentInRange: [],
};

function dayAfter(to: Date): Date {
  const d = new Date(to);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d;
}

export async function fetchImportCasesAnalytics(
  tenantId: string,
  from?: Date,
  to?: Date,
): Promise<ImportCasesAnalyticsData> {
  const tenantFilter = eq(importCases.tenantId, tenantId);
  const rangeFilter =
    from && to
      ? and(
          tenantFilter,
          gte(importCases.createdAt, from),
          lt(importCases.createdAt, dayAfter(to)),
        )
      : tenantFilter;

  try {
    const [
      totalResult,
      completedResult,
      inProgressResult,
      cancelledResult,
      statusRows,
      dailyRows,
      recentRows,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(importCases)
        .where(rangeFilter),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(importCases)
        .where(and(rangeFilter, eq(importCases.status, "completed"))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(importCases)
        .where(
          and(rangeFilter, inArray(importCases.status, IN_PROGRESS_STATUSES)),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(importCases)
        .where(and(rangeFilter, eq(importCases.status, "cancelled"))),
      db
        .select({
          status: importCases.status,
          count: sql<number>`count(*)::int`,
        })
        .from(importCases)
        .where(rangeFilter)
        .groupBy(importCases.status),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${importCases.createdAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(importCases)
        .where(
          from && to
            ? rangeFilter
            : and(
                tenantFilter,
                sql`${importCases.createdAt} >= now() - interval '7 days'`,
              ),
        )
        .groupBy(sql`date_trunc('day', ${importCases.createdAt})`)
        .orderBy(sql`date_trunc('day', ${importCases.createdAt})`),
      db
        .select({
          id: importCases.id,
          caseNumber: importCases.caseNumber,
          importerName: importCases.importerName,
          supplierName: importCases.supplierName,
          status: importCases.status,
          createdAt: importCases.createdAt,
          invoiceTotalAmount: importCases.invoiceTotalAmount,
          invoiceCurrencyCode: importCases.invoiceCurrencyCode,
        })
        .from(importCases)
        .where(rangeFilter)
        .orderBy(desc(importCases.updatedAt))
        .limit(10),
    ]);

    return {
      totalCount: totalResult[0]?.count ?? 0,
      completedCount: completedResult[0]?.count ?? 0,
      inProgressCount: inProgressResult[0]?.count ?? 0,
      cancelledCount: cancelledResult[0]?.count ?? 0,
      statusBreakdown: statusRows.map((r) => ({
        status: r.status ?? "draft",
        count: r.count,
      })),
      casesByDay: dailyRows.map((r) => ({ day: r.day, count: r.count })),
      recentInRange: recentRows,
    };
  } catch {
    return EMPTY;
  }
}

export type ClassificationTotals = {
  products: number;
  classified: number;
  finalized: number;
};

/**
 * Products extracted from import cases and how many have at least one
 * classification. Returns null when the query fails so callers can omit the
 * card instead of showing zeros.
 */
export async function fetchClassificationTotals(
  tenantId: string,
  from?: Date,
  to?: Date,
): Promise<ClassificationTotals | null> {
  const rangeFilter =
    from && to
      ? and(
          eq(importCases.tenantId, tenantId),
          gte(importCases.createdAt, from),
          lt(importCases.createdAt, dayAfter(to)),
        )
      : eq(importCases.tenantId, tenantId);

  try {
    const rows = await db
      .select({
        products: sql<number>`count(distinct ${importProducts.id})::int`,
        classified: sql<number>`count(distinct ${productClassifications.productId})::int`,
        finalized: sql<number>`count(distinct ${productClassifications.productId}) filter (where ${productClassifications.isFinal})::int`,
      })
      .from(importProducts)
      .innerJoin(importCases, eq(importCases.id, importProducts.importCaseId))
      .leftJoin(
        productClassifications,
        eq(productClassifications.productId, importProducts.id),
      )
      .where(rangeFilter);
    const row = rows[0];
    if (!row) return null;
    return {
      products: row.products,
      classified: row.classified,
      finalized: row.finalized,
    };
  } catch {
    return null;
  }
}

/**
 * Cases created per day (inclusive YYYY-MM-DD keys), split by outcome.
 * Returns null when the query fails so callers can omit the chart.
 */
export async function fetchImportCaseOutcomesByDay(
  tenantId: string,
  fromKey: string,
  toKey: string,
): Promise<OutcomeDayRow[] | null> {
  try {
    const rows = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${importCases.createdAt}), 'YYYY-MM-DD')`,
        completed: sql<number>`count(*) filter (where ${importCases.status} = 'completed')::int`,
        cancelled: sql<number>`count(*) filter (where ${importCases.status} = 'cancelled')::int`,
        inProgress: sql<number>`count(*) filter (where ${importCases.status} not in ('completed', 'cancelled'))::int`,
      })
      .from(importCases)
      .where(
        and(
          eq(importCases.tenantId, tenantId),
          sql`${importCases.createdAt} >= ${fromKey}::date`,
          sql`${importCases.createdAt} < (${toKey}::date + 1)`,
        ),
      )
      .groupBy(sql`date_trunc('day', ${importCases.createdAt})`)
      .orderBy(sql`date_trunc('day', ${importCases.createdAt})`);
    return rows.map((r) => ({
      day: r.day,
      completed: r.completed,
      inProgress: r.inProgress,
      cancelled: r.cancelled,
    }));
  } catch {
    return null;
  }
}

/**
 * Source country of a case: country of export, else supplier country, else
 * country of origin. Codes may be ISO alpha-2 or alpha-3; they are normalised
 * in `lib/dashboard-map-utils.ts`.
 */
const SOURCE_COUNTRY_SQL = sql<string | null>`upper(coalesce(nullif(trim(${importCases.countryOfExportCode}), ''), nullif(trim(${importCases.supplierCountryCode}), ''), nullif(trim(${importCases.countryOfOriginCode}), '')))`;

/**
 * Case counts per raw source-country code (null = no country on file).
 * Returns null when the query fails so callers can omit the map.
 */
export async function fetchCasesBySourceCountry(
  tenantId: string,
): Promise<{ code: string | null; count: number }[] | null> {
  try {
    const rows = await db
      .select({
        code: SOURCE_COUNTRY_SQL,
        count: sql<number>`count(*)::int`,
      })
      .from(importCases)
      .where(eq(importCases.tenantId, tenantId))
      .groupBy(SOURCE_COUNTRY_SQL);
    return rows.map((r) => ({ code: r.code ?? null, count: r.count }));
  } catch {
    return null;
  }
}

export async function fetchClientCasesBySourceCountry(
  tenantId: string,
  clientUserId: string,
): Promise<{ code: string | null; count: number }[] | null> {
  try {
    const rows = await db
      .select({
        code: SOURCE_COUNTRY_SQL,
        count: sql<number>`count(*)::int`,
      })
      .from(importCases)
      .where(
        and(
          eq(importCases.tenantId, tenantId),
          eq(importCases.clientUserId, clientUserId),
        ),
      )
      .groupBy(SOURCE_COUNTRY_SQL);
    return rows.map((r) => ({ code: r.code ?? null, count: r.count }));
  } catch {
    return null;
  }
}

/**
 * Cases created per rolling 7-day window (0 = the last 7 days) over the last
 * `weeks` windows, per raw source-country code. Null when the query fails.
 */
export async function fetchSourceCountryWeekly(
  tenantId: string,
  weeks = 8,
): Promise<{ code: string | null; weeksAgo: number; count: number }[] | null> {
  const weeksAgo = sql<number>`floor(extract(epoch from (now() - ${importCases.createdAt})) / 604800)::int`;
  try {
    const rows = await db
      .select({
        code: SOURCE_COUNTRY_SQL,
        weeksAgo,
        count: sql<number>`count(*)::int`,
      })
      .from(importCases)
      .where(
        and(
          eq(importCases.tenantId, tenantId),
          sql`${importCases.createdAt} >= now() - (${weeks}::int * interval '7 days')`,
        ),
      )
      .groupBy(SOURCE_COUNTRY_SQL, weeksAgo);
    return rows.map((r) => ({
      code: r.code ?? null,
      weeksAgo: r.weeksAgo,
      count: r.count,
    }));
  } catch {
    return null;
  }
}

export type InvoiceValueByCurrency = {
  currency: string;
  total: number;
  cases: number;
};

/**
 * Declared invoice value per currency (never summed across currencies).
 * Only cases with both an amount and a currency are included.
 */
export async function fetchInvoiceValueByCurrency(
  tenantId: string,
): Promise<InvoiceValueByCurrency[] | null> {
  try {
    const rows = await db
      .select({
        currency: sql<string>`upper(trim(${importCases.invoiceCurrencyCode}))`,
        total: sql<number>`coalesce(sum(${importCases.invoiceTotalAmount}), 0)::float8`,
        cases: sql<number>`count(*)::int`,
      })
      .from(importCases)
      .where(
        and(
          eq(importCases.tenantId, tenantId),
          sql`${importCases.invoiceTotalAmount} is not null`,
          sql`${importCases.invoiceCurrencyCode} is not null and trim(${importCases.invoiceCurrencyCode}) <> ''`,
        ),
      )
      .groupBy(sql`upper(trim(${importCases.invoiceCurrencyCode}))`)
      .orderBy(desc(sql`sum(${importCases.invoiceTotalAmount})`));
    return rows
      .filter((r) => Number.isFinite(r.total) && r.total > 0)
      .map((r) => ({ currency: r.currency, total: r.total, cases: r.cases }));
  } catch {
    return null;
  }
}