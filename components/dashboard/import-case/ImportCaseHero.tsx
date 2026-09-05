import { StatusBadge, Breadcrumbs } from "@/components/dashboard/ui";
import { getCountryLabel } from "@/lib/countries";
import {
  IMPORT_CASE_STATUS_LABELS,
  type ImportCaseStatus,
} from "@/lib/import-cases/constants";
import type { ImportCaseRow } from "@/db/schema/importCases";

export type ImportCaseHeroStats = {
  documents: number;
  products: number;
  verifiedProducts: number;
  approvedClassifications: number;
  groupings: number;
  openChecks: number;
};

type ImportCaseHeroProps = {
  importCase: ImportCaseRow;
  stats: ImportCaseHeroStats;
  progressPercent: number;
};

function formatDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function ImportCaseHero({
  importCase,
  stats,
  progressPercent,
}: ImportCaseHeroProps) {
  const status = (importCase.status as ImportCaseStatus) ?? "draft";
  const created = formatDate(importCase.createdAt);

  const metaItems = [
    importCase.supplierName
      ? { label: "Supplier", value: importCase.supplierName }
      : null,
    importCase.countryOfOriginCode
      ? {
          label: "Origin",
          value: getCountryLabel(importCase.countryOfOriginCode),
        }
      : null,
    importCase.countryOfExportCode
      ? {
          label: "Export",
          value: getCountryLabel(importCase.countryOfExportCode),
        }
      : null,
    importCase.shipmentReference
      ? { label: "Shipment", value: importCase.shipmentReference }
      : null,
    importCase.incoterm
      ? { label: "Incoterm", value: importCase.incoterm }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const statCards = [
    {
      label: "Documents",
      value: stats.documents,
      hint: "uploaded",
    },
    {
      label: "Products",
      value: `${stats.verifiedProducts}/${stats.products || 0}`,
      hint: "verified",
    },
    {
      label: "HS codes",
      value: `${stats.approvedClassifications}/${stats.products || 0}`,
      hint: "approved",
    },
    {
      label: "Groups",
      value: stats.groupings,
      hint: "declaration",
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.1)]">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/40 pointer-events-none" />
      <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-indigo-200/20 blur-3xl pointer-events-none" />

      <div className="relative p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <Breadcrumbs
              items={[
                { label: "Import cases", href: "/dashboard/import-cases" },
                { label: importCase.caseNumber },
              ]}
            />

            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {importCase.caseNumber}
              </h1>
              <StatusBadge
                label={IMPORT_CASE_STATUS_LABELS[status]}
                status={status}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-600">
              <span>{importCase.importerName ?? "Import case"}</span>
              {created ? (
                <>
                  <span className="hidden sm:inline text-slate-300">·</span>
                  <span className="text-xs text-slate-400">Created {created}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/70 backdrop-blur-sm px-3 py-2 shadow-sm">
              <div
                className="relative h-10 w-10 shrink-0"
                role="img"
                aria-label={`${progressPercent}% workflow complete`}
              >
                <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                  <title>Workflow progress</title>
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    className="stroke-slate-200"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    className="stroke-indigo-600"
                    strokeWidth="3"
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray={`${progressPercent} 100`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                  {progressPercent}%
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">
                  Workflow progress
                </p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  {stats.openChecks > 0
                    ? `${stats.openChecks} open check(s)`
                    : "Human approval required"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-white/90 bg-white/80 backdrop-blur-sm px-3 py-2 shadow-sm"
            >
              <p className="text-lg font-bold text-slate-900 tabular-nums leading-none">
                {card.value}
              </p>
              <p className="text-xs font-medium text-slate-700 mt-1">
                {card.label}
                <span className="font-normal text-slate-400"> · {card.hint}</span>
              </p>
            </div>
          ))}
        </div>

        {metaItems.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {metaItems.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/90 px-2.5 py-1 text-[11px] text-slate-600"
              >
                <span className="font-semibold text-slate-400 uppercase tracking-wide">
                  {item.label}
                </span>
                <span className="text-slate-700">{item.value}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
