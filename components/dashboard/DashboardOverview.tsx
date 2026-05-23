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
  PageHeader,
  StatusBadge,
} from "@/components/dashboard/ui";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { desc, eq, inArray, sql } from "drizzle-orm";

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

    const [
      recentRows,
      totalResult,
      completedResult,
      inProgressResult,
      failedResult,
      statusRows,
      dailyRows,
    ] = await Promise.all([
      db
        .select({
          id: documents.id,
          originalFileName: documents.originalFileName,
          status: documents.status,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .orderBy(desc(documents.createdAt))
        .limit(8),
      db.select({ count: sql<number>`count(*)::int` }).from(documents),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .where(eq(documents.status, "completed")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .where(inArray(documents.status, inProgressStatuses)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .where(eq(documents.status, "failed")),
      db
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
        .where(sql`${documents.createdAt} >= now() - interval '7 days'`)
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
      <PageHeader
        title="Dashboard"
        description="Overview of packing list uploads, HS classification, and exports."
        action={
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
        }
      />

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
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full tabular-nums">
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
              <tr className="bg-gray-50/80 text-left border-b border-gray-100">
                <th className="px-5 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs">
                  File
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs w-28">
                  Date
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs w-32">
                  Status
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs w-24 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-0">
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 text-[#007bff]">
                        <svg
                          className="w-7 h-7 opacity-60"
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
                      <p className="font-semibold text-gray-900">No documents yet</p>
                      <p className="mt-1 text-sm text-gray-500 max-w-xs">
                        Upload a packing list to get started with HS code
                        categorization.
                      </p>
                      <Link
                        href="/dashboard/upload"
                        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#007bff] text-white text-sm font-semibold hover:bg-[#0069d9] transition-colors shadow-md shadow-blue-500/20"
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
                    className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-gray-900 truncate block max-w-[200px] sm:max-w-md">
                        {doc.originalFileName ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-[#007bff] bg-blue-50 hover:bg-blue-100 transition-colors"
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
