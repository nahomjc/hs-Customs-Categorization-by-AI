import { AnalyticsBreakdownBars } from "@/components/dashboard/AnalyticsBreakdownBars";
import { AnalyticsDateFilter } from "@/components/dashboard/AnalyticsDateFilter";
import { AreaTrendChart } from "@/components/dashboard/bento/AreaTrendChart";
import {
  BentoCard,
  BentoCardHeader,
  BentoEmpty,
  BentoListRow,
  KpiRingTile,
  KpiSparkTile,
  KpiTile,
  PeriodPill,
  PromoBanner,
  PromoLink,
} from "@/components/dashboard/bento/BentoCard";
import {
  BENTO_COLORS,
  RingChart,
  RingLegend,
  StackedBarChart,
} from "@/components/dashboard/bento/charts";
import { BentoIcon } from "@/components/dashboard/bento/icons";
import {
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
  buildOutcomeSeries,
  type OutcomeDayRow,
  pctChange,
  sum,
} from "@/lib/dashboard-bento-utils";
import {
  IMPORT_CASE_STATUS_LABELS,
  type ImportCaseStatus,
} from "@/lib/import-cases/constants";
import type {
  ClassificationTotals,
  ImportCasesAnalyticsData,
} from "@/lib/import-cases-analytics";

function formatDocDate(d: Date | null): string {
  if (!d) return "-";
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
  if (!value) return "-";
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
  BENTO_COLORS.brand,
  BENTO_COLORS.indigo,
  BENTO_COLORS.sky,
  BENTO_COLORS.success,
  BENTO_COLORS.warning,
  BENTO_COLORS.muted,
  "#14b8a6",
  "#64748b",
];

type AnalyticsViewProps = {
  fromKey: string;
  toKey: string;
  importCasesData: ImportCasesAnalyticsData;
  clientsData: ClientsAnalyticsData;
  /** Cases per day by outcome for the selected range (null when unavailable). */
  currentOutcomes: OutcomeDayRow[] | null;
  /** Same, for the equally long period right before the range. */
  previousOutcomes: OutcomeDayRow[] | null;
  previousFromKey: string;
  previousToKey: string;
  classification: ClassificationTotals | null;
};

export function AnalyticsView({
  fromKey,
  toKey,
  importCasesData,
  clientsData,
  currentOutcomes,
  previousOutcomes,
  previousFromKey,
  previousToKey,
  classification,
}: AnalyticsViewProps) {
  const clientsSeries = buildDateRangeUploadSeries(
    clientsData.clientsByDay,
    new Date(`${fromKey}T00:00:00`),
    new Date(`${toKey}T00:00:00`),
  );

  const current = currentOutcomes
    ? buildOutcomeSeries(currentOutcomes, fromKey, toKey)
    : null;
  const previous = previousOutcomes
    ? buildOutcomeSeries(previousOutcomes, previousFromKey, previousToKey)
    : null;
  const comparable =
    current !== null &&
    previous !== null &&
    current.labels.length === previous.labels.length;

  const periodTotal = current ? sum(current.total) : null;
  const prevTotals = previous
    ? {
        total: sum(previous.total),
        completed: sum(previous.completed),
        inProgress: sum(previous.inProgress),
        cancelled: sum(previous.cancelled),
      }
    : null;

  const { totalCount, completedCount, inProgressCount, cancelledCount } =
    importCasesData;
  const completionRate =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const clientAdoptionRate =
    clientsData.totalClients > 0
      ? Math.round(
          (clientsData.activeClientsInRange / clientsData.totalClients) * 100,
        )
      : 0;
  const rangeLabel = formatRangeLabel(fromKey, toKey);

  const outcomeRows = [
    {
      label: "Completed",
      value: completedCount,
      color: BENTO_COLORS.success,
      delta: prevTotals ? pctChange(completedCount, prevTotals.completed) : null,
    },
    {
      label: "In progress",
      value: inProgressCount,
      color: BENTO_COLORS.brand,
      delta: prevTotals ? pctChange(inProgressCount, prevTotals.inProgress) : null,
    },
    {
      label: "Cancelled",
      value: cancelledCount,
      color: BENTO_COLORS.danger,
      delta: prevTotals ? pctChange(cancelledCount, prevTotals.cancelled) : null,
      invertDelta: true,
    },
  ];

  const topClientRows = clientsData.topClients.map((c, i) => ({
    label: clientDisplayName(c.fullName, c.email),
    count: c.casesInRange,
    color: CLIENT_BAR_COLORS[i % CLIENT_BAR_COLORS.length],
  }));

  const engagementRows = [
    {
      label: "Active this period",
      count: clientsData.activeClientsInRange,
      color: BENTO_COLORS.brand,
    },
    {
      label: "No cases in range",
      count: clientsData.clientsWithoutCases,
      color: BENTO_COLORS.muted,
    },
  ].filter((r) => r.count > 0);

  const caseCoverageRows = [
    {
      label: "Linked to a client",
      count: clientsData.casesWithClient,
      color: BENTO_COLORS.indigo,
    },
    {
      label: "Unassigned",
      count: clientsData.casesWithoutClient,
      color: BENTO_COLORS.warning,
    },
  ].filter((r) => r.count > 0);

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#007bff]">
          Insights
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Analytics
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {rangeLabel} &mdash; import case volume, client usage, and operational
          impact across Impact Logistics.
        </p>
      </div>

      <AnalyticsDateFilter from={fromKey} to={toKey} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left column */}
        <div className="grid min-w-0 content-start gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-1">
          <BentoCard className="sm:col-span-2 lg:col-span-1" label="Case outcomes">
            <BentoCardHeader title="Case outcomes" action={<PeriodPill>{rangeLabel}</PeriodPill>} />
            <div className="flex justify-center py-2">
              <RingChart
                segments={outcomeRows}
                centerValue={`${completionRate}%`}
                centerLabel="Complete"
                ariaLabel={`Case outcomes in range: ${completedCount} completed, ${inProgressCount} in progress, ${cancelledCount} cancelled`}
              />
            </div>
            <div className="mt-4">
              <RingLegend rows={outcomeRows} />
            </div>
          </BentoCard>
          <KpiTile
            label="Cases in range"
            value={totalCount.toLocaleString()}
            icon="cases"
            tone="blue"
            delta={prevTotals && periodTotal !== null ? pctChange(periodTotal, prevTotals.total) : null}
            hint={periodTotal !== null ? `${periodTotal} in chart` : undefined}
          />
          <KpiRingTile
            label="Completion rate"
            value={completedCount.toLocaleString()}
            percent={completionRate}
            tone="green"
            hint="Cases completed"
          />
          {classification && classification.products > 0 ? (
            <KpiRingTile
              label="Items classified"
              value={classification.classified.toLocaleString()}
              percent={(classification.classified / classification.products) * 100}
              tone="blue"
              hint={`of ${classification.products.toLocaleString()} extracted items`}
            />
          ) : null}
        </div>

        {/* Centre column */}
        <div className="min-w-0 space-y-4 lg:col-span-6">
          {current ? (
            <BentoCard label="Import case volume">
              <BentoCardHeader
                title="Import case volume"
                action={<PeriodPill>{current.granularity === "weekly" ? "Weekly" : "Daily"}</PeriodPill>}
              />
              <AreaTrendChart
                labels={current.labels}
                ariaLabel="Import cases created, selected period compared with the previous period"
                series={[
                  ...(comparable && previous
                    ? [
                        {
                          name: "Previous period",
                          color: BENTO_COLORS.muted,
                          values: previous.total,
                          dashed: true,
                        },
                      ]
                    : []),
                  {
                    name: "This period",
                    color: BENTO_COLORS.brand,
                    values: current.total,
                    fill: true,
                  },
                ]}
                emptyMessage="No import cases created in this range."
              />
            </BentoCard>
          ) : null}

          <PromoBanner
            title="Dig into the cases behind the numbers"
            description="Open the import case list to review statuses, importers, and classification progress."
            action={
              <PromoLink href="/dashboard/import-cases">
                View import cases
                <BentoIcon name="chevron" className="h-4 w-4" strokeWidth={2} />
              </PromoLink>
            }
          />

          {current ? (
            <BentoCard label="Outcome by day">
              <BentoCardHeader
                title={current.granularity === "weekly" ? "Outcome by week" : "Outcome by day"}
                action={<PeriodPill>{rangeLabel}</PeriodPill>}
              />
              <StackedBarChart
                labels={current.labels}
                ariaLabel="Import cases created by outcome"
                series={[
                  { name: "Completed", color: BENTO_COLORS.success, values: current.completed },
                  { name: "In progress", color: BENTO_COLORS.brand, values: current.inProgress },
                  { name: "Cancelled", color: BENTO_COLORS.danger, values: current.cancelled },
                ]}
              />
            </BentoCard>
          ) : null}
        </div>

        {/* Right column */}
        <div className="grid min-w-0 content-start gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-1">
          {current && periodTotal !== null ? (
            <KpiSparkTile
              label="Cases created"
              value={periodTotal}
              values={current.total}
              delta={prevTotals ? pctChange(periodTotal, prevTotals.total) : null}
              tone="blue"
              hint="Compared with the previous period"
            />
          ) : null}
          <KpiTile
            label="Clients in system"
            value={clientsData.totalClients.toLocaleString()}
            icon="users"
            tone="indigo"
            hint={`${clientsData.newClientsInRange} new in range`}
          />
          <KpiRingTile
            label="Active clients"
            value={clientsData.activeClientsInRange.toLocaleString()}
            percent={clientAdoptionRate}
            tone="blue"
            hint={`${clientAdoptionRate}% of all clients`}
          />
          <KpiTile
            label="Avg cases / client"
            value={clientsData.avgCasesPerActiveClient}
            icon="chart"
            tone="green"
            hint={`${clientsData.casesWithClient} linked cases`}
          />
          <KpiTile
            label="Invoice value"
            value={formatMoney(clientsData.totalInvoiceValue)}
            icon="money"
            tone="amber"
            hint="From client-linked cases"
          />
        </div>
      </div>

      {/* Clients */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <BentoCard className="lg:col-span-7" label="New clients over time">
          <BentoCardHeader
            title="New clients over time"
            action={<PeriodPill>{clientsSeries.length > 14 ? "Weekly" : "Daily"}</PeriodPill>}
          />
          <AreaTrendChart
            labels={clientsSeries.map((p) => p.label)}
            ariaLabel="New clients over time"
            unit="clients"
            series={[
              {
                name: "New clients",
                color: BENTO_COLORS.indigo,
                values: clientsSeries.map((p) => p.count),
                fill: true,
              },
            ]}
            emptyMessage="No new clients in this range."
          />
        </BentoCard>

        <BentoCard className="lg:col-span-5" label="Client engagement">
          <BentoCardHeader title="Client engagement" />
          <AnalyticsBreakdownBars
            title="Who is using imports"
            rows={engagementRows}
            emptyMessage="No clients in the system yet."
          />
        </BentoCard>

        <BentoCard className="lg:col-span-6" label="Top clients by import cases">
          <BentoCardHeader title="Top clients by import cases" />
          <AnalyticsBreakdownBars
            title="Cases in range"
            rows={topClientRows}
            emptyMessage="No client-linked import cases in this range."
          />
        </BentoCard>

        <BentoCard className="lg:col-span-6" label="Case and client coverage">
          <BentoCardHeader title="Case & client coverage" />
          <AnalyticsBreakdownBars
            title="Assignment"
            rows={caseCoverageRows}
            emptyMessage="No import cases in this range."
          />
        </BentoCard>
      </div>

      {/* Import cases list */}
      <BentoCard padded={false} label="Import cases in selected range">
        <BentoCardHeader
          inset
          title="Import cases in selected range"
          action={
            importCasesData.recentInRange.length > 0 ? (
              <DashLink href="/dashboard/import-cases">View all &rarr;</DashLink>
            ) : undefined
          }
        />
        {importCasesData.recentInRange.length === 0 ? (
          <BentoEmpty
            icon="cases"
            title="No import cases in this range"
            description="Try expanding the date filter or create a new import case."
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 px-2 pb-3 sm:hidden">
              {importCasesData.recentInRange.map((item) => (
                <BentoListRow
                  key={item.id}
                  href={`/dashboard/import-cases/${item.id}`}
                  title={item.caseNumber}
                  subtitle={[item.importerName, formatDocDate(item.createdAt)]
                    .filter(Boolean)
                    .join(" \u00b7 ")}
                  pill={
                    <StatusBadge
                      status={item.status}
                      label={formatImportCaseStatus(item.status)}
                    />
                  }
                />
              ))}
            </ul>
            <div className="hidden sm:block">
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
                  {importCasesData.recentInRange.map((item) => (
                    <DashTr key={item.id}>
                      <DashTd className="max-w-[160px] truncate font-semibold text-gray-900 sm:max-w-xs">
                        {item.caseNumber}
                      </DashTd>
                      <DashTd>{item.importerName ?? "-"}</DashTd>
                      <DashTd>{item.supplierName ?? "-"}</DashTd>
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
                          <BentoIcon name="chevron" className="h-3.5 w-3.5" strokeWidth={2} />
                        </DashTableAction>
                      </DashTd>
                    </DashTr>
                  ))}
                </DashTbody>
              </DashTable>
            </div>
          </>
        )}
      </BentoCard>

      <BentoCard padded={false} label="Clients driving import volume">
        <BentoCardHeader
          inset
          title="Clients driving import volume"
          action={
            clientsData.totalClients > 0 ? (
              <span className="flex items-center gap-4">
                {clientsData.topClients.length > 0 ? (
                  <DashLink href="/dashboard/import-cases">View cases &rarr;</DashLink>
                ) : null}
                <DashLink href="/dashboard/users">Manage clients &rarr;</DashLink>
              </span>
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
              <DashTh className="w-28">Invoice value</DashTh>
              <DashTh className="w-28">Last case</DashTh>
            </DashTableHeaderRow>
          </DashTableHead>
          <DashTbody>
            {clientsData.topClients.length === 0 ? (
              <DashTableEmpty colSpan={7} className="p-0">
                <BentoEmpty
                  icon="users"
                  title="No active clients in this range"
                  description="Invite clients and link them to import cases to see usage impact here."
                />
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
                  <DashTd className="tabular-nums text-[#007bff]">
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
      </BentoCard>

      {clientsData.totalClients > 0 && clientsData.topClients.length === 0 ? (
        <BentoCard padded={false} label="All clients in system">
          <BentoCardHeader inset title="All clients in system" />
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
                      label={client.status === "active" ? "Active" : client.status}
                    />
                  </DashTd>
                  <DashTd className="tabular-nums">{client.casesInRange}</DashTd>
                </DashTr>
              ))}
            </DashTbody>
          </DashTable>
        </BentoCard>
      ) : null}
    </div>
  );
}
