import Link from "next/link";
import {
  buildLast7DaysUploadSeries,
  DashboardUploadsChart,
} from "@/components/dashboard/DashboardUploadsChart";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";
import {
  DashboardStatusChart,
  type StatusCount,
} from "@/components/dashboard/DashboardStatusChart";
import {
  DashButton,
  DashCard,
  DashCardHeader,
  DashLink,
  StatusBadge,
} from "@/components/dashboard/ui";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { clampPreferencesForRole } from "@/lib/auth/settings-meta";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { documentScopeFilter } from "@/lib/settings/document-scope";
import { getUserPreferences } from "@/lib/settings/user-settings";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

const STATUS_LABELS: Record<string, string> = {
  uploaded: "Uploaded",
  parsed: "Parsed",
  ai_processed: "AI processing",
  grouped: "Grouped",
  completed: "Completed",
  failed: "Failed",
};

function formatStatus(status: string | null): string {
  return STATUS_LABELS[status ?? "uploaded"] ?? status ?? "Uploaded";
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export async function DashboardOverview() {
  let recent: {
    id: string;
    originalFileName: string | null;
    status: string | null;
    createdAt: Date | null;
  }[] = [];
  let totalCount = 0;
  let completedCount = 0;
  let inProgressCount = 0;
  let failedCount = 0;
  let statusBreakdown: StatusCount[] = [];
  let uploadsByDay: { day: string; count: number }[] = [];

  try {
    const inProgressStatuses = ["uploaded", "parsed", "ai_processed", "grouped"];
    const session = await getSessionUserProfile();
    const authUser = session?.authUser;
    const prefs =
      authUser?.id != null
        ? clampPreferencesForRole(
            await getUserPreferences(authUser.id),
            session?.profile?.role
          )
        : null;
    const scope =
      authUser?.email && authUser.id && prefs
        ? documentScopeFilter(
            {
              id: authUser.id,
              email: authUser.email,
              role: session?.profile?.role,
            },
            prefs
          )
        : undefined;

    const withScope = (extra?: SQL) =>
      extra && scope ? and(scope, extra) : extra ?? scope;

    const [
      recentRows,
      totalResult,
      completedResult,
      inProgressResult,
      failedResult,
      statusRows,
      dailyRows,
    ] = await Promise.all([
      scope
        ? db
            .select({
              id: documents.id,
              originalFileName: documents.originalFileName,
              status: documents.status,
              createdAt: documents.createdAt,
            })
            .from(documents)
            .where(scope)
            .orderBy(desc(documents.createdAt))
            .limit(8)
        : db
            .select({
              id: documents.id,
              originalFileName: documents.originalFileName,
              status: documents.status,
              createdAt: documents.createdAt,
            })
            .from(documents)
            .orderBy(desc(documents.createdAt))
            .limit(8),
      scope
        ? db
            .select({ count: sql<number>`count(*)::int` })
            .from(documents)
            .where(scope)
        : db.select({ count: sql<number>`count(*)::int` }).from(documents),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .where(withScope(eq(documents.status, "completed"))!),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .where(withScope(inArray(documents.status, inProgressStatuses))!),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .where(withScope(eq(documents.status, "failed"))!),
      scope
        ? db
            .select({
              status: documents.status,
              count: sql<number>`count(*)::int`,
            })
            .from(documents)
            .where(scope)
            .groupBy(documents.status)
        : db
            .select({
              status: documents.status,
              count: sql<number>`count(*)::int`,
            })
            .from(documents)
            .groupBy(documents.status),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${documents.createdAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(documents)
        .where(
          withScope(
            sql`${documents.createdAt} >= now() - interval '7 days'`
          )!
        )
        .groupBy(sql`date_trunc('day', ${documents.createdAt})`)
        .orderBy(sql`date_trunc('day', ${documents.createdAt})`),
    ]);

    recent = recentRows;
    totalCount = totalResult[0]?.count ?? 0;
    completedCount = completedResult[0]?.count ?? 0;
    inProgressCount = inProgressResult[0]?.count ?? 0;
    failedCount = failedResult[0]?.count ?? 0;
    statusBreakdown = statusRows.map((r) => ({
      status: r.status ?? "uploaded",
      count: r.count,
    }));
    uploadsByDay = dailyRows.map((r) => ({ day: r.day, count: r.count }));
  } catch {
    // DB not configured
  }

  const uploadSeries = buildLast7DaysUploadSeries(uploadsByDay);
  const completionRate =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const weekTotal = uploadSeries.reduce((s, d) => s + d.count, 0);

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Welcome hero */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_8px_40px_-12px_rgba(15,23,42,0.1)]">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-400/15 blur-3xl" />
          <div className="absolute -bottom-12 left-1/4 h-40 w-40 rounded-full bg-violet-400/10 blur-3xl" />
        </div>
        <div className="relative flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">
              Overview
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Dashboard
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-slate-500">
              Track uploads, classification progress, and export-ready packing lists.
            </p>
          </div>
          <DashButton href="/dashboard/upload" variant="primary">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <title>Upload</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Upload packing list
          </DashButton>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <DashboardStatCard
          label="Total documents"
          value={totalCount}
          hint={`${weekTotal} uploaded this week`}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <title>Documents</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
        />
        <DashboardStatCard
          label="Completed"
          value={completedCount}
          hint={
            totalCount > 0 ? `${completionRate}% completion rate` : "Ready to export"
          }
          accent="green"
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <title>Completed</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <DashboardStatCard
          label="In progress"
          value={inProgressCount}
          hint="Parsing or classifying"
          accent="blue"
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <title>In progress</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <DashboardStatCard
          label="Failed"
          value={failedCount}
          hint={failedCount > 0 ? "Needs attention" : "All clear"}
          accent={failedCount > 0 ? "red" : "default"}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <title>Failed</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <DashCard className="lg:col-span-3">
          <DashCardHeader
            title="Uploads — last 7 days"
            action={
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 tabular-nums">
                {weekTotal} total
              </span>
            }
          />
          <div className="px-5 py-5 sm:px-6 sm:pb-6">
            <DashboardUploadsChart data={uploadSeries} />
          </div>
        </DashCard>

        <DashCard className="lg:col-span-2">
          <DashCardHeader title="Status breakdown" />
          <div className="px-5 py-5 sm:px-6 sm:pb-6">
            <DashboardStatusChart items={statusBreakdown} />
          </div>
        </DashCard>
      </div>

      <DashCard>
        <DashCardHeader
          title="Recent documents"
          action={
            recent.length > 0 ? (
              <DashLink href="/dashboard/history">View all →</DashLink>
            ) : undefined
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                  File
                </th>
                <th className="px-5 py-3 w-28 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Date
                </th>
                <th className="px-5 py-3 w-32 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="px-5 py-3 w-24 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-0">
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                        <svg
                          className="h-8 w-8"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <title>Empty</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <p className="font-bold text-slate-900">No documents yet</p>
                      <p className="mt-1 max-w-xs text-sm text-slate-500">
                        Upload a packing list to get started with HS code
                        categorization.
                      </p>
                      <Link
                        href="/dashboard/upload"
                        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30"
                      >
                        Upload your first file
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                recent.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-t border-slate-50 transition-colors hover:bg-indigo-50/20"
                  >
                    <td className="px-5 py-3.5">
                      <span className="block max-w-[200px] truncate font-semibold text-slate-900 sm:max-w-md">
                        {doc.originalFileName ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-500">
                      {formatDate(doc.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge
                        status={doc.status}
                        label={formatStatus(doc.status)}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/dashboard/documents/${doc.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                      >
                        View
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <title>View</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DashCard>
    </div>
  );
}
