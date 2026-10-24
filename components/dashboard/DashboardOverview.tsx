import {
  BentoCard,
  BentoCardHeader,
  BentoEmpty,
  KpiRingTile,
  KpiSparkTile,
  PeriodPill,
} from "@/components/dashboard/bento/BentoCard";
import {
  AmountListRow,
  GradientHeroCard,
  KpiProgressTile,
  StatList,
} from "@/components/dashboard/bento/DashboardCards";
import { BENTO_COLORS } from "@/components/dashboard/bento/charts";
import { DonutChart, DonutLegend } from "@/components/dashboard/bento/DonutChart";
import { BentoIcon } from "@/components/dashboard/bento/icons";
import { SourceCountryMap } from "@/components/dashboard/map/SourceCountryMap";
import { DashButton, DashLink, StatusBadge } from "@/components/dashboard/ui";
import {
  buildOutcomeSeries,
  pctChange,
  shiftKey,
  sum,
  todayKeyUtc,
} from "@/lib/dashboard-bento-utils";
import {
  formatShare,
  summarizeSourceCountries,
  weeklySeries,
} from "@/lib/dashboard-map-utils";
import {
  IMPORT_CASE_STATUS_LABELS,
  type ImportCaseStatus,
} from "@/lib/import-cases/constants";
import {
  fetchCasesBySourceCountry,
  fetchClassificationTotals,
  fetchImportCaseOutcomesByDay,
  fetchImportCasesAnalytics,
  fetchInvoiceValueByCurrency,
  fetchSourceCountryWeekly,
} from "@/lib/import-cases-analytics";
import { getTenantId } from "@/lib/import-cases/queries";

function formatImportCaseStatus(status: string | null): string {
  const key = (status ?? "draft") as ImportCaseStatus;
  return IMPORT_CASE_STATUS_LABELS[key] ?? status ?? "Draft";
}

function formatDate(d: Date | null): string {
  if (!d) return "-";
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en-US")}`;
  }
}

function formatCaseAmount(
  amount: string | null,
  currency: string | null,
): string | null {
  if (amount === null || !currency?.trim()) return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return formatMoney(n, currency.trim().toUpperCase());
}

export async function DashboardOverview() {
  const tenantId = getTenantId();
  const todayKey = todayKeyUtc();
  const weekFromKey = shiftKey(todayKey, -6);
  const prevToKey = shiftKey(todayKey, -7);
  const prevFromKey = shiftKey(todayKey, -13);

  const [
    importCasesData,
    outcomeRows,
    classification,
    sourceRows,
    sourceWeekly,
    invoiceValues,
  ] = await Promise.all([
    fetchImportCasesAnalytics(tenantId),
    fetchImportCaseOutcomesByDay(tenantId, prevFromKey, todayKey),
    fetchClassificationTotals(tenantId),
    fetchCasesBySourceCountry(tenantId),
    fetchSourceCountryWeekly(tenantId, 8),
    fetchInvoiceValueByCurrency(tenantId),
  ]);

  const week = outcomeRows
    ? buildOutcomeSeries(outcomeRows, weekFromKey, todayKey)
    : null;
  const prevWeek = outcomeRows
    ? buildOutcomeSeries(outcomeRows, prevFromKey, prevToKey)
    : null;
  const weekTotal = week ? sum(week.total) : null;
  const prevWeekTotal = prevWeek ? sum(prevWeek.total) : null;
  const weekDelta =
    weekTotal !== null ? pctChange(weekTotal, prevWeekTotal) : null;

  const { totalCount, completedCount, inProgressCount, cancelledCount } =
    importCasesData;
  const otherCount = Math.max(
    0,
    totalCount - completedCount - inProgressCount - cancelledCount,
  );
  const completionRate =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const inProgressPct =
    totalCount > 0 ? Math.round((inProgressCount / totalCount) * 100) : 0;

  const statusRows = [
    { label: "Completed", value: completedCount, color: BENTO_COLORS.success },
    { label: "In progress", value: inProgressCount, color: BENTO_COLORS.brand },
    {
      label: "Cancelled",
      value: cancelledCount,
      color: BENTO_COLORS.danger,
    },
    ...(otherCount > 0
      ? [{ label: "Other", value: otherCount, color: BENTO_COLORS.muted }]
      : []),
  ];

  const sourceSummary = summarizeSourceCountries(sourceRows ?? []);
  const topSources = sourceSummary.countries.slice(0, 5);
  const sourceTrend = sourceWeekly !== null;
  const sourceColors = [
    BENTO_COLORS.brand,
    BENTO_COLORS.indigo,
    BENTO_COLORS.sky,
    BENTO_COLORS.success,
    BENTO_COLORS.warning,
  ];

  const recent = importCasesData.recentInRange.slice(0, 6);
  const valueLines = (invoiceValues ?? []).slice(0, 3).map((v) => ({
    label: `Declared invoice value (${v.currency})`,
    value: formatMoney(v.total, v.currency),
  }));

  const kpiCount = [
    true,
    true,
    !!classification && classification.products > 0,
    !!week && weekTotal !== null,
  ].filter(Boolean).length;

  const rowTwoCards =
    1 + (topSources.length > 0 ? 1 : 0) + (totalCount > 0 ? 1 : 0);

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#007bff]">
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
          <BentoIcon name="plus" className="h-5 w-5" strokeWidth={2} />
          New import case
        </DashButton>
      </div>

      {/* Row 1: map + hero and KPI tiles */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <SourceCountryMap summary={sourceSummary} periodLabel="All time" />
        </div>

        <div className="grid min-w-0 content-start gap-4 xl:col-span-4">
          <GradientHeroCard
            title="Total import cases"
            caption="Created, all time"
            value={totalCount.toLocaleString()}
            lines={[
              ...(weekTotal !== null
                ? [{ label: "Created this week", value: weekTotal.toLocaleString() }]
                : []),
              ...valueLines,
            ]}
            href="/dashboard/import-cases"
          />
          <div
            className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
              kpiCount % 2 === 1 ? "sm:[&>*:last-child]:col-span-2" : ""
            }`}
          >
            <KpiRingTile
              label="Completion rate"
              value={completedCount.toLocaleString()}
              percent={completionRate}
              tone="green"
              hint="Cases completed"
            />
            <KpiProgressTile
              label="In progress"
              badgeValue={inProgressCount.toLocaleString()}
              percent={inProgressPct}
              caption={`${inProgressPct}% of all cases`}
              hint="Extraction or classification"
            />
            {classification && classification.products > 0 ? (
              <KpiRingTile
                label="Items classified"
                value={classification.classified.toLocaleString()}
                percent={
                  (classification.classified / classification.products) * 100
                }
                tone="blue"
                hint={`of ${classification.products.toLocaleString()} items`}
              />
            ) : null}
            {week && weekTotal !== null ? (
              <KpiSparkTile
                label="Cases this week"
                value={weekTotal}
                values={week.total}
                delta={weekDelta}
                tone="blue"
                hint="vs previous 7 days"
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Row 2: top sources, case status donut, recent cases */}
      <div
        className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${
          rowTwoCards >= 3 ? "xl:grid-cols-3" : "xl:grid-cols-2"
        }`}
      >
        {topSources.length > 0 ? (
          <BentoCard label="Top source countries">
            <BentoCardHeader
              title="Top source countries"
              action={<PeriodPill>All time</PeriodPill>}
            />
            <StatList
              trendLabel="cases per week, last 8 weeks"
              rows={topSources.map((c, i) => ({
                key: c.iso2,
                label: c.name,
                value: `${c.count.toLocaleString()} ${c.count === 1 ? "case" : "cases"}`,
                caption: `${formatShare(c.share)} of cases`,
                series: sourceTrend ? weeklySeries(sourceWeekly ?? [], c.iso2) : undefined,
                percent: c.share,
                color: sourceColors[i % sourceColors.length],
              }))}
            />
            <p className="mt-3 text-[11px] text-slate-400">
              Trend lines show cases created per week over the last 8 weeks.
            </p>
          </BentoCard>
        ) : null}

        {totalCount > 0 ? (
          <BentoCard label="Case status">
            <BentoCardHeader
              title="Case status"
              action={<PeriodPill>All time</PeriodPill>}
            />
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full min-w-0 sm:flex-1">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Status breakdown
                </p>
                <DonutLegend rows={statusRows} />
              </div>
              <DonutChart
                segments={statusRows}
                centerValue={totalCount.toLocaleString()}
                centerLabel="Cases"
                size={168}
                ariaLabel={`Case status: ${statusRows
                  .map((r) => `${r.value} ${r.label.toLowerCase()}`)
                  .join(", ")}`}
              />
            </div>
          </BentoCard>
        ) : null}

        <BentoCard
          padded={false}
          label="Recent import cases"
          className={rowTwoCards >= 3 ? "md:col-span-2 xl:col-span-1" : ""}
        >
          <BentoCardHeader
            inset
            title="Recent import cases"
            action={
              recent.length > 0 ? (
                <DashLink href="/dashboard/import-cases">View all &rarr;</DashLink>
              ) : undefined
            }
          />
          {recent.length === 0 ? (
            <BentoEmpty
              icon="cases"
              title="No import cases yet"
              description="Create an import case to upload invoices, packing lists, and run HS classification."
              action={
                <DashButton href="/dashboard/import-cases/new">
                  Create your first case
                </DashButton>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100 px-2 pb-3 sm:px-3">
              {recent.map((item) => (
                <AmountListRow
                  key={item.id}
                  href={`/dashboard/import-cases/${item.id}`}
                  title={item.caseNumber}
                  subtitle={[
                    item.importerName ?? item.supplierName,
                    formatDate(item.createdAt),
                  ]
                    .filter(Boolean)
                    .join(" \u00b7 ")}
                  pill={
                    <StatusBadge
                      status={item.status}
                      label={formatImportCaseStatus(item.status)}
                    />
                  }
                  amount={formatCaseAmount(
                    item.invoiceTotalAmount,
                    item.invoiceCurrencyCode,
                  )}
                />
              ))}
            </ul>
          )}
        </BentoCard>
      </div>
    </div>
  );
}