import { AnalyticsBreakdownBars } from "@/components/dashboard/AnalyticsBreakdownBars";
import { AnalyticsDateFilter } from "@/components/dashboard/AnalyticsDateFilter";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";
import { DashboardStatusChart } from "@/components/dashboard/DashboardStatusChart";
import { DashboardUploadsChart } from "@/components/dashboard/DashboardUploadsChart";
import {
  DashCard,
  DashCardHeader,
  DashLink,
  DashTable,
  DashTableAction,
  DashTableEmpty,
  DashTableHead,
  DashTableHeaderRow,
  DashTbody,
  DashTd,
  DashTh,
  DashTr,
  StatusBadge,
} from "@/components/dashboard/ui";
import type { ClientsAnalyticsData } from "@/lib/clients-analytics";
import {
  buildDateRangeUploadSeries,
  formatRangeLabel,
} from "@/lib/dashboard-analytics-utils";
import {
  IMPORT_CASE_STATUS_LABELS,
  type ImportCaseStatus,
} from "@/lib/import-cases/constants";
import type { ImportCasesAnalyticsData } from "@/lib/import-cases-analytics";

function formatDocDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatImportCaseStatus(status: string | null): string {
  const key = (status ?? "draft") as ImportCaseStatus;
  return IMPORT_CASE_STATUS_LABELS[key] ?? status ?? "Draft";
}

function formatMoney(value: number): string {
  if (!value) return "—";
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function clientDisplayName(fullName: string | null, email: string): string {
  return fullName?.trim() || email;
}

const CLIENT_BAR_COLORS = [
  "#7c3aed",
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#6366f1",
  "#14b8a6",
];

type AnalyticsViewProps = {
  fromKey: string;
  toKey: string;
  importCasesData: ImportCasesAnalyticsData;
  clientsData: ClientsAnalyticsData;
};

export function AnalyticsView({
  fromKey,
  toKey,
  importCasesData,
  clientsData,
}: AnalyticsViewProps) {
  const importCaseSeries = buildDateRangeUploadSeries(
    importCasesData.casesByDay,
    new Date(`${fromKey}T00:00:00`),
    new Date(`${toKey}T00:00:00`),
  );
  const clientsSeries = buildDateRangeUploadSeries(
    clientsData.clientsByDay,
    new Date(`${fromKey}T00:00:00`),
    new Date(`${toKey}T00:00:00`),
  );
  const importCasePeriodTotal = importCaseSeries.reduce(
    (s, d) => s + d.count,
    0,
  );
  const importCaseCompletionRate =
    importCasesData.totalCount > 0
      ? Math.round(
          (importCasesData.completedCount / importCasesData.totalCount) * 100,
        )
      : 0;
  const clientAdoptionRate =
    clientsData.totalClients > 0
      ? Math.round(
          (clientsData.activeClientsInRange / clientsData.totalClients) * 100,
        )
      : 0;
  const rangeLabel = formatRangeLabel(fromKey, toKey);

  const topClientRows = clientsData.topClients.map((c, i) => ({
    label: clientDisplayName(c.fullName, c.email),
    count: c.casesInRange,
    color: CLIENT_BAR_COLORS[i % CLIENT_BAR_COLORS.length],
  }));

  const engagementRows = [
    {
      label: "Active this period",
      count: clientsData.activeClientsInRange,
      color: "#7c3aed",
    },
    {
      label: "No cases in range",
      count: clientsData.clientsWithoutCases,
      color: "#94a3b8",
    },
  ].filter((r) => r.count > 0);

  const caseCoverageRows = [
    {
      label: "Linked to a client",
      count: clientsData.casesWithClient,
      color: "#4f46e5",
    },
    {
      label: "Unassigned",
      count: clientsData.casesWithoutClient,
      color: "#f59e0b",
    },
  ].filter((r) => r.count > 0);

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
            {rangeLabel} — import case volume, client usage, and operational
            impact across Impact Logistics.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-3xl sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Import cases
              </p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-violet-700">
                {importCasesData.totalCount}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Case completion
              </p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-700">
                {importCaseCompletionRate}%
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Clients
              </p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-indigo-700">
                {clientsData.totalClients}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Client adoption
              </p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-700">
                {clientAdoptionRate}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <AnalyticsDateFilter from={fromKey} to={toKey} />

      {/* Import cases */}
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Import cases</h2>
            <p className="text-sm text-slate-500">
              Cases created in the selected date range
            </p>
          </div>
          {importCasesData.totalCount > 0 ? (
            <DashLink href="/dashboard/import-cases">View all →</DashLink>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            label="Cases in range"
            value={importCasesData.totalCount}
            hint={`${importCasePeriodTotal} in chart`}
            accent="violet"
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <title>Cases</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
          />
          <DashboardStatCard
            label="Completed"
            value={importCasesData.completedCount}
            hint={`${importCaseCompletionRate}% completion rate`}
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
            value={importCasesData.inProgressCount}
            hint="Extraction or classification"
            accent="blue"
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <title>In progress</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <DashboardStatCard
            label="Cancelled"
            value={importCasesData.cancelledCount}
            hint={importCasesData.cancelledCount > 0 ? "Review cases" : "None cancelled"}
            accent={importCasesData.cancelledCount > 0 ? "red" : "default"}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <title>Cancelled</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <DashCard className="lg:col-span-3">
          <DashCardHeader
            title="Import case volume"
            action={
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                {importCaseSeries.length > 14 ? "Weekly" : "Daily"}
              </span>
            }
          />
          <div className="overflow-x-auto px-5 py-5 sm:px-6 sm:pb-6">
            <DashboardUploadsChart
              data={importCaseSeries}
              granularity={importCaseSeries.length > 14 ? "weekly" : "daily"}
            />
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
          title="Import cases in selected range"
          action={
            importCasesData.recentInRange.length > 0 ? (
              <DashLink href="/dashboard/import-cases">View all →</DashLink>
            ) : undefined
          }
        />
        <DashTable>
          <DashTableHead>
            <DashTableHeaderRow>
              <DashTh>Case #</DashTh>
              <DashTh>Importer</DashTh>
              <DashTh>Supplier</DashTh>
              <DashTh className="w-28">Date</DashTh>
              <DashTh className="w-40">Status</DashTh>
              <DashTh align="right" className="w-20">
                Action
              </DashTh>
            </DashTableHeaderRow>
          </DashTableHead>
          <DashTbody>
            {importCasesData.recentInRange.length === 0 ? (
              <DashTableEmpty colSpan={6} className="p-0">
                <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <title>No import cases</title>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <p className="font-semibold text-slate-800">No import cases in this range</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Try expanding the date filter or create a new import case.
                  </p>
                </div>
              </DashTableEmpty>
            ) : (
              importCasesData.recentInRange.map((item) => (
                <DashTr key={item.id}>
                  <DashTd className="max-w-[160px] truncate font-semibold text-gray-900 sm:max-w-xs">
                    {item.caseNumber}
                  </DashTd>
                  <DashTd>{item.importerName ?? "—"}</DashTd>
                  <DashTd>{item.supplierName ?? "—"}</DashTd>
                  <DashTd muted nowrap>
                    {formatDocDate(item.createdAt)}
                  </DashTd>
                  <DashTd>
                    <StatusBadge
                      status={item.status}
                      label={formatImportCaseStatus(item.status)}
                    />
                  </DashTd>
                  <DashTd align="right">
                    <DashTableAction href={`/dashboard/import-cases/${item.id}`}>
                      Open
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <title>Open case</title>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </DashTableAction>
                  </DashTd>
                </DashTr>
              ))
            )}
          </DashTbody>
        </DashTable>
      </DashCard>

      {/* Clients */}
      <div className="pt-2">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Client usage &amp; import impact
            </h2>
            <p className="text-sm text-slate-500">
              Clients in the system and how they drive import case volume
            </p>
          </div>
          {clientsData.totalClients > 0 ? (
            <DashLink href="/dashboard/users">Manage clients →</DashLink>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            label="Clients in system"
            value={clientsData.totalClients}
            hint={`${clientsData.newClientsInRange} new in range`}
            accent="violet"
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <title>Clients</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-4-4h-1m-4 6v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2h5m4 0H9m4-10a4 4 0 11-8 0 4 4 0 018 0zm10 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
          />
          <DashboardStatCard
            label="Active clients"
            value={clientsData.activeClientsInRange}
            hint={`${clientAdoptionRate}% of all clients`}
            accent="green"
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <title>Active</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
          />
          <DashboardStatCard
            label="Avg cases / client"
            value={clientsData.avgCasesPerActiveClient}
            hint={`${clientsData.casesWithClient} linked cases`}
            accent="blue"
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <title>Average</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            }
          />
          <DashboardStatCard
            label="Invoice value"
            value={formatMoney(clientsData.totalInvoiceValue)}
            hint="From client-linked cases"
            accent="amber"
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <title>Invoice</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <DashCard className="lg:col-span-3">
          <DashCardHeader
            title="New clients over time"
            action={
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                {clientsSeries.length > 14 ? "Weekly" : "Daily"}
              </span>
            }
          />
          <div className="overflow-x-auto px-5 py-5 sm:px-6 sm:pb-6">
            <DashboardUploadsChart
              data={clientsSeries}
              granularity={clientsSeries.length > 14 ? "weekly" : "daily"}
            />
          </div>
        </DashCard>

        <DashCard className="lg:col-span-2">
          <DashCardHeader title="Client engagement" />
          <div className="px-5 py-5 sm:px-6 sm:pb-6">
            <AnalyticsBreakdownBars
              title="Who is using imports"
              rows={engagementRows}
              emptyMessage="No clients in the system yet."
            />
          </div>
        </DashCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DashCard>
          <DashCardHeader title="Top clients by import cases" />
          <div className="px-5 py-5 sm:px-6 sm:pb-6">
            <AnalyticsBreakdownBars
              title="Cases in range"
              rows={topClientRows}
              emptyMessage="No client-linked import cases in this range."
            />
          </div>
        </DashCard>
        <DashCard>
          <DashCardHeader title="Case ↔ client coverage" />
          <div className="px-5 py-5 sm:px-6 sm:pb-6">
            <AnalyticsBreakdownBars
              title="Assignment"
              rows={caseCoverageRows}
              emptyMessage="No import cases in this range."
            />
          </div>
        </DashCard>
      </div>

      <DashCard>
        <DashCardHeader
          title="Clients driving import volume"
          action={
            clientsData.topClients.length > 0 ? (
              <DashLink href="/dashboard/import-cases">View cases →</DashLink>
            ) : undefined
          }
        />
        <DashTable>
          <DashTableHead>
            <DashTableHeaderRow>
              <DashTh>Client</DashTh>
              <DashTh>Email</DashTh>
              <DashTh className="w-24">Cases</DashTh>
              <DashTh className="w-28">Completed</DashTh>
              <DashTh className="w-28">In progress</DashTh>
              <DashTh className="w-28">Invoice Σ</DashTh>
              <DashTh className="w-28">Last case</DashTh>
            </DashTableHeaderRow>
          </DashTableHead>
          <DashTbody>
            {clientsData.topClients.length === 0 ? (
              <DashTableEmpty colSpan={7} className="p-0">
                <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <title>No active clients</title>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-4-4h-1m-4 6v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2h5m4 0H9m4-10a4 4 0 11-8 0 4 4 0 018 0zm10 0a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <p className="font-semibold text-slate-800">
                    No active clients in this range
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Invite clients and link them to import cases to see usage
                    impact here.
                  </p>
                </div>
              </DashTableEmpty>
            ) : (
              clientsData.topClients.map((client) => (
                <DashTr key={client.id}>
                  <DashTd className="max-w-[180px] truncate font-semibold text-gray-900 sm:max-w-xs">
                    {clientDisplayName(client.fullName, client.email)}
                  </DashTd>
                  <DashTd muted className="max-w-[200px] truncate">
                    {client.email}
                  </DashTd>
                  <DashTd className="tabular-nums font-semibold text-slate-900">
                    {client.casesInRange}
                  </DashTd>
                  <DashTd className="tabular-nums text-emerald-700">
                    {client.completedCases}
                  </DashTd>
                  <DashTd className="tabular-nums text-indigo-700">
                    {client.inProgressCases}
                  </DashTd>
                  <DashTd className="tabular-nums">
                    {formatMoney(client.invoiceTotalSum)}
                  </DashTd>
                  <DashTd muted nowrap>
                    {formatDocDate(client.lastCaseAt)}
                  </DashTd>
                </DashTr>
              ))
            )}
          </DashTbody>
        </DashTable>
      </DashCard>

      {clientsData.totalClients > 0 && clientsData.topClients.length === 0 ? (
        <DashCard>
          <DashCardHeader title="All clients in system" />
          <DashTable>
            <DashTableHead>
              <DashTableHeaderRow>
                <DashTh>Client</DashTh>
                <DashTh>Email</DashTh>
                <DashTh className="w-28">Joined</DashTh>
                <DashTh className="w-28">Status</DashTh>
                <DashTh className="w-24">Cases</DashTh>
              </DashTableHeaderRow>
            </DashTableHead>
            <DashTbody>
              {clientsData.recentClients.map((client) => (
                <DashTr key={client.id}>
                  <DashTd className="font-semibold text-gray-900">
                    {clientDisplayName(client.fullName, client.email)}
                  </DashTd>
                  <DashTd muted>{client.email}</DashTd>
                  <DashTd muted nowrap>
                    {formatDocDate(client.createdAt)}
                  </DashTd>
                  <DashTd>
                    <StatusBadge
                      status={client.status}
                      label={
                        client.status === "active" ? "Active" : client.status
                      }
                    />
                  </DashTd>
                  <DashTd className="tabular-nums">{client.casesInRange}</DashTd>
                </DashTr>
              ))}
            </DashTbody>
          </DashTable>
        </DashCard>
      ) : null}
    </div>
  );
}
