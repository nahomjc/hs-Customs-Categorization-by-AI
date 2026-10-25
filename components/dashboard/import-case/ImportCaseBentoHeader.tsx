import {
  BentoCard,
  KpiRingTile,
  KpiTile,
} from "@/components/dashboard/bento/BentoCard";
import { BENTO_COLORS, RingChart } from "@/components/dashboard/bento/charts";
import { BentoIcon } from "@/components/dashboard/bento/icons";
import { ClientShipmentTrackingHeaderAction } from "@/components/dashboard/import-case/ClientShipmentTrackingHeaderAction";
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

type AdjacentCaseLink = {
  id: string;
  caseNumber: string;
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
  clientLabel?: string | null;
  clientAvatarUrl?: string | null;
  clientEmail?: string | null;
  previousCase?: AdjacentCaseLink | null;
  nextCase?: AdjacentCaseLink | null;
};

function clientInitials(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]?.charAt(0) ?? "";
      const b = parts[1]?.charAt(0) ?? "";
      return `${a}${b}`.toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase();
  }
  if (email?.trim()) return email.trim().slice(0, 2).toUpperCase();
  return "CL";
}

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
  clientLabel = null,
  clientAvatarUrl = null,
  clientEmail = null,
  previousCase = null,
  nextCase = null,
}: ImportCaseBentoHeaderProps) {
  const status = (importCase.status as ImportCaseStatus) ?? "draft";
  const created = formatDate(importCase.createdAt);
  const pct = Math.max(0, Math.min(100, Math.round(progressPercent)));
  const initials = clientInitials(clientLabel, clientEmail);

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            items={[
              { label: "Import cases", href: "/dashboard/import-cases" },
              { label: importCase.caseNumber },
            ]}
          />
          <div className="flex shrink-0 items-center gap-2">
            <DashButton
              href={
                previousCase
                  ? `/dashboard/import-cases/${previousCase.id}`
                  : undefined
              }
              variant="secondary"
              disabled={!previousCase}
              className="px-3 py-2"
            >
              ← Previous
            </DashButton>
            <DashButton
              href={
                nextCase
                  ? `/dashboard/import-cases/${nextCase.id}`
                  : undefined
              }
              variant="secondary"
              disabled={!nextCase}
              className="px-3 py-2"
            >
              Next →
            </DashButton>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="shrink-0">
              {clientAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote user avatar URLs
                <img
                  src={clientAvatarUrl}
                  alt={clientLabel ? `${clientLabel} avatar` : "Client avatar"}
                  className="h-16 w-16 rounded-2xl border border-slate-200/80 object-cover shadow-sm sm:h-[4.5rem] sm:w-[4.5rem]"
                />
              ) : (
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#007bff]/15 bg-gradient-to-br from-[#007bff] to-[#0069d9] text-lg font-bold tracking-wide text-white shadow-sm sm:h-[4.5rem] sm:w-[4.5rem] sm:text-xl"
                  aria-hidden={!clientLabel}
                  title={clientLabel ?? "No client linked"}
                >
                  {initials}
                </span>
              )}
              <p className="mt-1.5 max-w-[4.5rem] truncate text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Client
              </p>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#007bff]">
                Import case
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="break-all text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {importCase.caseNumber}
                </h1>
                <StatusBadge
                  label={IMPORT_CASE_STATUS_LABELS[status]}
                  status={status}
                />
              </div>
              <p className="text-sm text-slate-500">
                {clientLabel ? (
                  <>
                    <span className="font-medium text-slate-700">{clientLabel}</span>
                    {importCase.importerName ? (
                      <>
                        <span className="mx-2 text-slate-300" aria-hidden="true">
                          &middot;
                        </span>
                        <span>{importCase.importerName}</span>
                      </>
                    ) : null}
                  </>
                ) : (
                  (importCase.importerName ?? "Import case")
                )}
                {created ? (
                  <>
                    <span className="mx-2 text-slate-300" aria-hidden="true">
                      &middot;
                    </span>
                    <span className="text-xs text-slate-400">
                      Created {created}
                    </span>
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
            <div className="flex flex-col gap-2 sm:items-end">
              <ClientShipmentTrackingHeaderAction
                caseId={importCase.id}
                caseNumber={importCase.caseNumber}
                trackingStatus={importCase.trackingStatus}
                trackingNote={importCase.trackingNote}
                clientLabel={clientLabel}
              />
              <div className="flex flex-wrap gap-2 sm:justify-end">
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