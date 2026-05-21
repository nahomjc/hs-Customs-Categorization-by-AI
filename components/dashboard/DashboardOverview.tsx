import Link from "next/link";
import {
  DashButton,
  DashCard,
  DashCardHeader,
  DashLink,
  PageHeader,
  StatCard,
  StatusBadge,
} from "@/components/dashboard/ui";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

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

export async function DashboardOverview() {
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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Manage and track your packing list categorizations."
        action={
          <DashButton href="/dashboard/upload" variant="primary">
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
          </DashButton>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total documents" value={totalCount} />
        <StatCard label="Completed" value={completedCount} accent="green" />
        <StatCard
          label="Ready to download"
          value={completedCount}
          accent="blue"
        />
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
                      <span className="font-medium text-gray-900 truncate block max-w-[200px] sm:max-w-none">
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
                        href={"/dashboard/documents/" + doc.id}
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
