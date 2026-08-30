import { db } from "@/db";
import { importCases } from "@/db/schema";
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
