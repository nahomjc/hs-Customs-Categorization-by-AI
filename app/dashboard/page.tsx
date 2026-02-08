import Link from "next/link";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  uploaded: "Uploaded",
  parsed: "Parsed",
  ai_processed: "AI processing",
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

export default async function DashboardPage() {
  let recent: {
    id: string;
    originalFileName: string | null;
    status: string | null;
    createdAt: Date | null;
  }[] = [];
  let totalCount = 0;
  let completedCount = 0;

  try {
    const [recentRows, totalResult, completedResult] = await Promise.all([
      db
        .select({
          id: documents.id,
          originalFileName: documents.originalFileName,
          status: documents.status,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .orderBy(desc(documents.createdAt))
        .limit(10),
      db.select({ count: sql<number>`count(*)::int` }).from(documents),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .where(eq(documents.status, "completed")),
    ]);
    recent = recentRows;
    totalCount = totalResult[0]?.count ?? 0;
    completedCount = completedResult[0]?.count ?? 0;
  } catch {
    // DB not configured
  }

  const statusBadge = (s: string | null) => {
    const status = s ?? "uploaded";
    const styles: Record<string, string> = {
      uploaded: "bg-stone-100 text-stone-700",
      parsed: "bg-amber-100 text-amber-800",
      ai_processed: "bg-amber-100 text-amber-800",
      completed: "bg-emerald-100 text-emerald-800",
      failed: "bg-red-100 text-red-800",
    };
    const c = styles[status] ?? styles.uploaded;
    return (
      <span
        className={
          "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium " +
          c
        }
      >
        {formatStatus(status)}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Welcome and primary CTA */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
            Dashboard
          </h1>
          <p className="mt-1 text-[var(--foreground)]/70">
            Manage and track your packing list categorizations.
          </p>
        </div>
        <Link
          href="/dashboard/upload"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] font-medium transition-colors shadow-sm shrink-0"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Upload packing list
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-[var(--background-card)] rounded-xl border border-[var(--border)] p-5 shadow-sm">
          <p className="text-sm font-medium text-[var(--foreground)]/70">
            Total documents
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--foreground)] tabular-nums">
            {totalCount}
          </p>
        </div>
        <div className="bg-[var(--background-card)] rounded-xl border border-[var(--border)] p-5 shadow-sm">
          <p className="text-sm font-medium text-[var(--foreground)]/70">
            Completed
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-700 tabular-nums">
            {completedCount}
          </p>
        </div>
        <div className="bg-[var(--background-card)] rounded-xl border border-[var(--border)] p-5 shadow-sm sm:col-span-2 lg:col-span-1">
          <p className="text-sm font-medium text-[var(--foreground)]/70">
            Ready to download
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--accent)] tabular-nums">
            {completedCount}
          </p>
        </div>
      </div>

      {/* Recent documents card */}
      <div className="bg-[var(--background-card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold text-[var(--foreground)]">
            Recent documents
          </h2>
          {recent.length > 0 && (
            <Link
              href="/dashboard/history"
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              View all →
            </Link>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--background)]/80 text-left">
                <th className="px-5 py-3 font-medium text-[var(--foreground)]/70 uppercase tracking-wider text-xs">
                  File
                </th>
                <th className="px-5 py-3 font-medium text-[var(--foreground)]/70 uppercase tracking-wider text-xs w-28">
                  Date
                </th>
                <th className="px-5 py-3 font-medium text-[var(--foreground)]/70 uppercase tracking-wider text-xs w-32">
                  Status
                </th>
                <th className="px-5 py-3 font-medium text-[var(--foreground)]/70 uppercase tracking-wider text-xs w-24 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-0">
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                      <div className="w-14 h-14 rounded-full bg-[var(--background)] flex items-center justify-center mb-4">
                        <svg
                          className="w-7 h-7 text-[var(--foreground)]/40"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <p className="font-medium text-[var(--foreground)]">
                        No documents yet
                      </p>
                      <p className="mt-1 text-sm text-[var(--foreground)]/60 max-w-xs">
                        Upload a packing list to get started with HS code
                        categorization.
                      </p>
                      <Link
                        href="/dashboard/upload"
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
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
                    className="border-t border-[var(--border-subtle)] hover:bg-[var(--background)]/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <span className="font-medium text-[var(--foreground)] truncate block max-w-[200px] sm:max-w-none">
                        {doc.originalFileName ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[var(--foreground)]/70 whitespace-nowrap">
                      {formatDate(doc.createdAt)}
                    </td>
                    <td className="px-5 py-3">{statusBadge(doc.status)}</td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={"/dashboard/documents/" + doc.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--accent)] bg-[var(--accent-light)]/50 hover:bg-[var(--accent-light)] transition-colors"
                      >
                        View
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
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
      </div>
    </div>
  );
}
