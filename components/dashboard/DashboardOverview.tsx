import Link from "next/link";
import {
  buildLast7DaysUploadSeries,
  DashboardUploadsChart,
} from "@/components/dashboard/DashboardUploadsChart";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";
import { DashboardStatusChart } from "@/components/dashboard/DashboardStatusChart";
import {
  DashButton,
  DashCard,
  DashCardHeader,
  DashLink,
  StatusBadge,
} from "@/components/dashboard/ui";
import {
  IMPORT_CASE_STATUS_LABELS,
  type ImportCaseStatus,
} from "@/lib/import-cases/constants";
import { fetchImportCasesAnalytics } from "@/lib/import-cases-analytics";
import { getTenantId } from "@/lib/import-cases/queries";

function formatImportCaseStatus(status: string | null): string {
  const key = (status ?? "draft") as ImportCaseStatus;
  return IMPORT_CASE_STATUS_LABELS[key] ?? status ?? "Draft";
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
  const tenantId = getTenantId();
  const importCasesData = await fetchImportCasesAnalytics(tenantId);

  const importCaseUploadSeries = buildLast7DaysUploadSeries(
    importCasesData.casesByDay,
  );
  const importCaseWeekTotal = importCaseUploadSeries.reduce(
    (s, d) => s + d.count,
    0,
  );
  const importCaseCompletionRate =
    importCasesData.totalCount > 0
      ? Math.round(
          (importCasesData.completedCount / importCasesData.totalCount) * 100,
        )
      : 0;

  return (
    <div className="w-full min-w-0 space-y-6">
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
              Track import cases, document extraction, HS classification, and
              declaration-ready exports.
            </p>
          </div>
          <DashButton href="/dashboard/import-cases/new" variant="primary">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <title>Create</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New import case
          </DashButton>
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Import cases</h2>
            <p className="text-sm text-slate-500">
              Ethiopian customs document preparation workflow
            </p>
          </div>
          {importCasesData.totalCount > 0 ? (
            <DashLink href="/dashboard/import-cases">View all →</DashLink>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <DashboardStatCard
            label="Total cases"
            value={importCasesData.totalCount}
            hint={`${importCaseWeekTotal} created this week`}
            accent="violet"
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <title>Cases</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            }
          />
          <DashboardStatCard
            label="Completed"
            value={importCasesData.completedCount}
            hint={
              importCasesData.totalCount > 0
                ? `${importCaseCompletionRate}% completion rate`
                : "Ready for declaration"
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
            value={importCasesData.inProgressCount}
            hint="Extraction or classification"
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
            label="Cancelled"
            value={importCasesData.cancelledCount}
            hint={
              importCasesData.cancelledCount > 0 ? "Review cases" : "None cancelled"
            }
            accent={importCasesData.cancelledCount > 0 ? "red" : "default"}
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <title>Cancelled</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <DashCard className="lg:col-span-3">
          <DashCardHeader
            title="Import cases — last 7 days"
            action={
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 tabular-nums">
                {importCaseWeekTotal} total
              </span>
            }
          />
          <div className="px-5 py-5 sm:px-6 sm:pb-6">
            <DashboardUploadsChart data={importCaseUploadSeries} />
          </div>
        </DashCard>

        <DashCard className="lg:col-span-2">
          <DashCardHeader title="Case status breakdown" />
          <div className="px-5 py-5 sm:px-6 sm:pb-6">
            <DashboardStatusChart
              items={importCasesData.statusBreakdown}
              variant="import-cases"
            />
          </div>
        </DashCard>
      </div>

      <DashCard>
        <DashCardHeader
          title="Recent import cases"
          action={
            importCasesData.recentInRange.length > 0 ? (
              <DashLink href="/dashboard/import-cases">View all →</DashLink>
            ) : undefined
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Case #
                </th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Importer
                </th>
                <th className="px-5 py-3 w-28 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Date
                </th>
                <th className="px-5 py-3 w-40 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="px-5 py-3 w-24 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {importCasesData.recentInRange.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
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
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                          />
                        </svg>
                      </div>
                      <p className="font-bold text-slate-900">
                        No import cases yet
                      </p>
                      <p className="mt-1 max-w-xs text-sm text-slate-500">
                        Create an import case to upload invoices, packing lists,
                        and run HS classification.
                      </p>
                      <Link
                        href="/dashboard/import-cases/new"
                        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:shadow-violet-500/30"
                      >
                        Create your first case
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                importCasesData.recentInRange.slice(0, 8).map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-slate-50 transition-colors hover:bg-violet-50/20"
                  >
                    <td className="px-5 py-3.5">
                      <span className="block max-w-[140px] truncate font-semibold text-slate-900 sm:max-w-xs">
                        {item.caseNumber}
                      </span>
                      {item.supplierName ? (
                        <span className="block max-w-[140px] truncate text-xs text-slate-500 sm:max-w-xs">
                          {item.supplierName}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {item.importerName ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-500">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge
                        status={item.status}
                        label={formatImportCaseStatus(item.status)}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/dashboard/import-cases/${item.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100"
                      >
                        Open
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <title>Open</title>
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
