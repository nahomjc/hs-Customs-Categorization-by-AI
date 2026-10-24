import {
  BentoCard,
  KpiRingTile,
  KpiTile,
} from "@/components/dashboard/bento/BentoCard";
import { BENTO_COLORS, RingChart } from "@/components/dashboard/bento/charts";
import { BentoIcon } from "@/components/dashboard/bento/icons";
import type { ImportCaseHeroStats } from "@/components/dashboard/import-case/ImportCaseHero";
import { Breadcrumbs, DashButton, StatusBadge } from "@/components/dashboard/ui";
import type { ImportCaseRow } from "@/db/schema/importCases";
import { getCountryLabel } from "@/lib/countries";
import {
  IMPORT_CASE_STATUS_LABELS,
  type ImportCaseStatus,
} from "@/lib/import-cases/constants";

export type CaseInvoiceValue = {
  amount: number;
  currency: string | null;
  /** Where the number comes from, shown as the tile hint. */
  source: "case" | "lines";
};

type ImportCaseBentoHeaderProps = {
  importCase: ImportCaseRow;
  stats: ImportCaseHeroStats;
  progressPercent: number;
  completedSteps: number;
  totalSteps: number;
  invoiceLineCount: number;
  packingLineCount: number;
  invoiceValue: CaseInvoiceValue | null;
};

function formatDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatAmount(value: CaseInvoiceValue): string {
  const n = value.amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value.currency ? `${value.currency} ${n}` : n;
}

/**
 * Bento header for the import case page: title card (reference, status,
 * key meta, actions, workflow ring) plus KPI tiles built from real case data.
 */
export function ImportCaseBentoHeader({
  importCase,
  stats,
  progressPercent,
  completedSteps,
  totalSteps,
  invoiceLineCount,
  packingLineCount,
  invoiceValue,
}: ImportCaseBentoHeaderProps) {
  const status = (importCase.status as ImportCaseStatus) ?? "draft";
  const created = formatDate(importCase.createdAt);
  const pct = Math.max(0, Math.min(100, Math.round(progressPercent)));

  const metaItems = [
    importCase.supplierName
      ? { label: "Supplier", value: importCase.supplierName }
      : null,
    importCase.countryOfOriginCode
      ? { label: "Origin", value: getCountryLabel(importCase.countryOfOriginCode) }
      : null,
    importCase.shipmentReference
      ? { label: "Shipment", value: importCase.shipmentReference }
      : null,
    importCase.incoterm ? { label: "Incoterm", value: importCase.incoterm } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const hsPercent =
    stats.products > 0
      ? Math.round((stats.approvedClassifications / stats.products) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <BentoCard label="Import case summary">
        <Breadcrumbs
          items={[
            { label: "Import cases", href: "/dashboard/import-cases" },
            { label: importCase.caseNumber },
          ]}
        />

        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#007bff]">
              Import case
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="break-all text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {importCase.caseNumber}
              </h1>
              <StatusBadge label={IMPORT_CASE_STATUS_LABELS[status]} status={status} />
            </div>
            <p className="text-sm text-slate-500">
              {importCase.importerName ?? "Import case"}
              {created ? (
                <>
                  <span className="mx-2 text-slate-300" aria-hidden="true">
                    &middot;
                  </span>
                  <span className="text-xs text-slate-400">Created {created}</span>
                </>
              ) : null}
            </p>
            {metaItems.length > 0 ? (
              <ul className="flex list-none flex-wrap gap-1.5 pt-1">
                {metaItems.map((item) => (
                  <li
                    key={item.label}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600"
                  >
                    <span className="font-semibold uppercase tracking-wide text-slate-400">
                      {item.label}
                    </span>
                    <span className="truncate text-slate-700">{item.value}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:shrink-0">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <RingChart
                size={64}
                thickness={10}
                segments={[
                  { label: "Complete", value: pct, color: BENTO_COLORS.brand },
                  { label: "Remaining", value: 100 - pct, color: "transparent" },
                ]}
                ariaLabel={`Workflow progress: ${pct}% complete`}
                centerValue={`${pct}%`}
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">Workflow progress</p>
                <p className="text-xs text-slate-500">
                  {completedSteps} of {totalSteps} steps
                </p>
                {stats.openChecks > 0 ? (
                  <p className="text-xs font-semibold text-amber-600">
                    {stats.openChecks} open check{stats.openChecks === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <DashButton href="/dashboard/import-cases" variant="secondary">
                All cases
              </DashButton>
              <DashButton href="/dashboard/import-cases/new" variant="primary">
                <BentoIcon name="plus" className="h-4 w-4" strokeWidth={2} />
                New case
              </DashButton>
            </div>
          </div>
        </div>
      </BentoCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
        <KpiTile
          label="Documents"
          value={stats.documents.toLocaleString("en-US")}
          icon="document"
          tone="indigo"
          hint="Uploaded to this case"
        />
        <KpiTile
          label="Invoice lines"
          value={invoiceLineCount.toLocaleString("en-US")}
          icon="list"
          tone="blue"
          hint={`${packingLineCount.toLocaleString("en-US")} packing list lines`}
        />
        {stats.products > 0 ? (
          <KpiRingTile
            label="HS codes approved"
            value={`${stats.approvedClassifications}/${stats.products}`}
            percent={hsPercent}
            tone="green"
            hint={`${stats.verifiedProducts} products verified`}
          />
        ) : null}
        {invoiceValue ? (
          <KpiTile
            label="Invoice value"
            value={formatAmount(invoiceValue)}
            icon="money"
            tone="blue"
            hint={invoiceValue.source === "case" ? "Declared on case" : "Sum of invoice lines"}
          />
        ) : null}
        <KpiTile
          label="Open checks"
          value={stats.openChecks.toLocaleString("en-US")}
          icon={stats.openChecks > 0 ? "clock" : "check"}
          tone={stats.openChecks > 0 ? "amber" : "green"}
          hint={stats.openChecks > 0 ? "Need review" : "Nothing to resolve"}
        />
      </div>
    </div>
  );
}