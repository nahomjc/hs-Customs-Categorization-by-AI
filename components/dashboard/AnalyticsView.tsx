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
  PageHeader,
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
};

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: "#ef4444",
  docx: "#007bff",
  xlsx: "#10b981",
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
      <PageHeader
        title="Analytics"
        description={`Insights for ${formatRangeLabel(fromKey, toKey)}. Filter by calendar to explore uploads and classification outcomes.`}
      />

      <AnalyticsDateFilter from={fromKey} to={toKey} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <DashboardStatCard
          label="Documents in range"
          value={data.totalCount}
          hint={`${periodTotal} uploads in chart`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <title>Completed</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <DashboardStatCard
          label="In progress"
          value={data.inProgressCount}
          hint="Still processing"
          accent="blue"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <title>Failed</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <DashCard className="lg:col-span-3">
          <DashCardHeader
            title="Upload volume"
            action={
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {uploadSeries.length > 14 ? "Weekly" : "Daily"}
              </span>
            }
          />
          <div className="px-5 py-5 sm:px-6 sm:pb-6 overflow-x-auto">
            <div className={uploadSeries.length > 10 ? "min-w-[520px]" : ""}>
              <DashboardUploadsChart data={uploadSeries} />
            </div>
          </div>
        </DashCard>

        <DashCard className="lg:col-span-2">
          <DashCardHeader title="Status breakdown" />
          <div className="px-5 py-5 sm:px-6 sm:pb-6">
            <DashboardStatusChart items={data.statusBreakdown} />
          </div>
        </DashCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <tr className="bg-gray-50/80 text-left border-b border-gray-100">
                <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File
                </th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Type
                </th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                  Date
                </th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Status
                </th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-20 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {data.recentInRange.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-500">
                    No documents found for this date range. Try expanding the calendar
                    filter.
                  </td>
                </tr>
              ) : (
                data.recentInRange.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-t border-gray-50 hover:bg-gray-50/50"
                  >
                    <td className="px-5 py-3.5 font-medium text-gray-900 truncate max-w-[200px] sm:max-w-md">
                      {doc.originalFileName ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 uppercase text-xs">
                      {doc.fileType ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
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
                        className="text-sm font-medium text-[#007bff] hover:underline"
                      >
                        View
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
