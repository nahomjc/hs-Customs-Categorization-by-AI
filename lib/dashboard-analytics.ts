import { db } from "@/db";
import { documents } from "@/db/schema";
import type { AnalyticsData } from "@/lib/dashboard-analytics-utils";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

const IN_PROGRESS = ["uploaded", "parsed", "ai_processed", "grouped"];

function dayAfter(to: Date): Date {
  const d = new Date(to);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d;
}

export async function fetchAnalytics(
  from: Date,
  to: Date,
): Promise<AnalyticsData> {
  const rangeEnd = dayAfter(to);
  const rangeFilter = and(
    gte(documents.createdAt, from),
    lt(documents.createdAt, rangeEnd),
  );

  const empty: AnalyticsData = {
    totalCount: 0,
    completedCount: 0,
    inProgressCount: 0,
    failedCount: 0,
    statusBreakdown: [],
    uploadsByDay: [],
    fileTypeBreakdown: [],
    modeBreakdown: [],
    recentInRange: [],
  };

  try {
    const [
      totalResult,
      completedResult,
      inProgressResult,
      failedResult,
      statusRows,
      dailyRows,
      fileTypeRows,
      modeRows,
      recentRows,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .where(rangeFilter),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .where(and(rangeFilter, eq(documents.status, "completed"))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .where(and(rangeFilter, inArray(documents.status, IN_PROGRESS))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .where(and(rangeFilter, eq(documents.status, "failed"))),
      db
        .select({
          status: documents.status,
          count: sql<number>`count(*)::int`,
        })
        .from(documents)
        .where(rangeFilter)
        .groupBy(documents.status),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${documents.createdAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(documents)
        .where(rangeFilter)
        .groupBy(sql`date_trunc('day', ${documents.createdAt})`)
        .orderBy(sql`date_trunc('day', ${documents.createdAt})`),
      db
        .select({
          fileType: documents.fileType,
          count: sql<number>`count(*)::int`,
        })
        .from(documents)
        .where(rangeFilter)
        .groupBy(documents.fileType),
      db
        .select({
          mode: documents.classificationMode,
          count: sql<number>`count(*)::int`,
        })
        .from(documents)
        .where(rangeFilter)
        .groupBy(documents.classificationMode),
      db
        .select({
          id: documents.id,
          originalFileName: documents.originalFileName,
          status: documents.status,
          fileType: documents.fileType,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(rangeFilter)
        .orderBy(desc(documents.createdAt))
        .limit(10),
    ]);

    return {
      totalCount: totalResult[0]?.count ?? 0,
      completedCount: completedResult[0]?.count ?? 0,
      inProgressCount: inProgressResult[0]?.count ?? 0,
      failedCount: failedResult[0]?.count ?? 0,
      statusBreakdown: statusRows.map((r) => ({
        status: r.status ?? "uploaded",
        count: r.count,
      })),
      uploadsByDay: dailyRows.map((r) => ({ day: r.day, count: r.count })),
      fileTypeBreakdown: fileTypeRows.map((r) => ({
        fileType: r.fileType,
        count: r.count,
      })),
      modeBreakdown: modeRows.map((r) => ({
        mode: r.mode ?? "ai",
        count: r.count,
      })),
      recentInRange: recentRows,
    };
  } catch {
    return empty;
  }
}
