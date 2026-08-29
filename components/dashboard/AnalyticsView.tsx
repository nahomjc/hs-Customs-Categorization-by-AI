import Link from "next/link";
import { AnalyticsBreakdownBars } from "@/components/dashboard/AnalyticsBreakdownBars";
import { AnalyticsDateFilter } from "@/components/dashboard/AnalyticsDateFilter";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";
import { DashboardStatusChart } from "@/components/dashboard/DashboardStatusChart";
import { DashboardUploadsChart } from "@/components/dashboard/DashboardUploadsChart";
import {
  DashCard,
  DashCardHeader,
  DashLink,
  StatusBadge,
} from "@/components/dashboard/ui";
import {
  buildDateRangeUploadSeries,
  type AnalyticsData,
  formatRangeLabel,
} from "@/lib/dashboard-analytics-utils";

const STATUS_LABELS: Record<string, string> = {
  uploaded: "Uploaded",
  parsed: "Parsed",
  ai_processed: "AI processing",
  grouped: "Grouped",
  completed: "Completed",
  failed: "Failed",
};

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  docx: "Word",
  xlsx: "Excel",
  csv: "CSV",
};

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: "#f43f5e",
  docx: "#3b82f6",
  xlsx: "#10b981",
  csv: "#6366f1",
};

const FILE_TYPE_BADGE: Record<string, string> = {
  pdf: "bg-rose-50 text-rose-700 border-rose-200/80",
  docx: "bg-blue-50 text-blue-700 border-blue-200/80",
  xlsx: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  csv: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
};

function formatStatus(status: string | null): string {
  return STATUS_LABELS[status ?? "uploaded"] ?? status ?? "Uploaded";
}

function formatDocDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type AnalyticsViewProps = {
  fromKey: string;
  toKey: string;
  data: AnalyticsData;
};

export function AnalyticsView({ fromKey, toKey, data }: AnalyticsViewProps) {
  const uploadSeries = buildDateRangeUploadSeries(
    data.uploadsByDay,
    new Date(`${fromKey}T00:00:00`),
    new Date(`${toKey}T00:00:00`),
  );
  const periodTotal = uploadSeries.reduce((s, d) => s + d.count, 0);
  const completionRate =
    data.totalCount > 0
      ? Math.round((data.completedCount / data.totalCount) * 100)
      : 0;
  const rangeLabel = formatRangeLabel(fromKey, toKey);

  const fileTypeRows = data.fileTypeBreakdown.map((r) => ({
    label: FILE_TYPE_LABELS[r.fileType] ?? r.fileType.toUpperCase(),
    count: r.count,
    color: FILE_TYPE_COLORS[r.fileType] ?? "#94a3b8",
  }));

  const modeRows = data.modeBreakdown.map((r) => ({
    label: r.mode === "pre_coded" ? "Pre-coded HS" : "AI classification",
    count: r.count,
    color: r.mode === "pre_coded" ? "#0ea5e9" : "#6366f1",
  }));

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_8px_40px_-12px_rgba(15,23,42,0.1)]">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-400/15 blur-3xl" />
          <div className="absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-indigo-400/10 blur-3xl" />
        </div>
        <div className="relative px-5 py-5 sm:px-7 sm:py-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-violet-600">
            Insights
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Analytics
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {rangeLabel} — uploads, classification outcomes, and file breakdowns.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-lg">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Period uploads
              </p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-indigo-700">
                {periodTotal}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Completion
              </p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-700">
                {completionRate}%
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                In range
              </p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">
                {data.totalCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      <AnalyticsDateFilter from={fromKey} to={toKey} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Documents in range"
          value={data.totalCount}
          hint={`${periodTotal} uploads in chart`}
          accent="blue"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <title>Total</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <DashboardStatCard
          label="Completed"
          value={data.completedCount}
          hint={`${completionRate}% completion rate`}
          accent="green"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <title>Completed</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <DashboardStatCard
          label="In progress"
          value={data.inProgressCount}
          hint="Still processing"
          accent="violet"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <title>In progress</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <DashboardStatCard
          label="Failed"
          value={data.failedCount}
          hint={data.failedCount > 0 ? "Review required" : "No failures"}
          accent={data.failedCount > 0 ? "red" : "default"}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <title>Failed</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <DashCard className="lg:col-span-3">
          <DashCardHeader
            title="Upload volume"
            action={
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                {uploadSeries.length > 14 ? "Weekly" : "Daily"}
              </span>
            }
          />
          <div className="overflow-x-auto px-5 py-5 sm:px-6 sm:pb-6">
            <DashboardUploadsChart
              data={uploadSeries}
              granularity={uploadSeries.length > 14 ? "weekly" : "daily"}
            />
          </div>
        </DashCard>

        <DashCard className="lg:col-span-2">
          <DashCardHeader title="Status breakdown" />
          <div className="px-5 py-5 sm:px-6 sm:pb-6">
            <DashboardStatusChart items={data.statusBreakdown} />
          </div>
        </DashCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DashCard>
          <DashCardHeader title="File types" />
          <div className="px-5 py-5 sm:px-6 sm:pb-6">
            <AnalyticsBreakdownBars
              title="By format"
              rows={fileTypeRows}
              emptyMessage="No uploads in this date range."
            />
          </div>
        </DashCard>
        <DashCard>
          <DashCardHeader title="Classification mode" />
          <div className="px-5 py-5 sm:px-6 sm:pb-6">
            <AnalyticsBreakdownBars
              title="By mode"
              rows={modeRows}
              emptyMessage="No classification data in this range."
            />
          </div>
        </DashCard>
      </div>

      <DashCard>
        <DashCardHeader
          title="Documents in selected range"
          action={
            data.recentInRange.length > 0 ? (
              <DashLink href="/dashboard/history">Full history →</DashLink>
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
                <th className="px-5 py-3 w-24 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Type
                </th>
                <th className="px-5 py-3 w-28 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Date
                </th>
                <th className="px-5 py-3 w-32 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="px-5 py-3 w-20 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {data.recentInRange.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="font-semibold text-slate-800">No documents in this range</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Try expanding the date filter or upload a new packing list.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.recentInRange.map((doc) => {
                  const ft = doc.fileType ?? "";
                  const typeBadge =
                    FILE_TYPE_BADGE[ft] ??
                    "bg-slate-50 text-slate-600 border-slate-200/80";
                  return (
                    <tr
                      key={doc.id}
                      className="border-t border-slate-50 transition-colors hover:bg-indigo-50/20"
                    >
                      <td className="max-w-[200px] truncate px-5 py-3.5 font-semibold text-slate-900 sm:max-w-md">
                        {doc.originalFileName ?? "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-lg border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${typeBadge}`}
                        >
                          {FILE_TYPE_LABELS[ft] ?? ft ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-500">
                        {formatDocDate(doc.createdAt)}
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
                          className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                        >
                          View
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DashCard>
    </div>
  );
}
