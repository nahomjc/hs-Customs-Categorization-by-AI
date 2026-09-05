"use client";

import Link from "next/link";
import { Breadcrumbs } from "@/components/dashboard/ui";
import { fileTypeIconColor, fileTypeLabel } from "@/lib/documentUiUtils";

type DocumentHeroHeaderProps = {
  fileName: string | null;
  itemCount: number;
  groupCount: number;
  reviewCount: number;
  exportLabel: string;
  downloadHref: string;
  isPreCoded: boolean;
};

export function DocumentHeroHeader({
  fileName,
  itemCount,
  groupCount,
  reviewCount,
  exportLabel,
  downloadHref,
  isPreCoded,
}: DocumentHeroHeaderProps) {
  const iconGradient = fileTypeIconColor(fileName);
  const typeLabel = fileTypeLabel(fileName);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)]">
      {/* Ambient mesh */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        aria-hidden
      >
        <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-violet-400/15 blur-3xl" />
        <div className="absolute top-1/2 right-1/3 h-32 w-32 rounded-full bg-emerald-300/10 blur-2xl" />
      </div>

      <div className="relative px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <Breadcrumbs
              items={[
                { label: "History", href: "/dashboard/history" },
                { label: fileName ?? "Document" },
              ]}
            />

            <div className="flex items-start gap-4">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${iconGradient} shadow-lg shadow-slate-900/10`}
              >
                <svg
                  aria-hidden
                  className="h-7 w-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-slate-900/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    {typeLabel}
                  </span>
                  {isPreCoded && (
                    <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
                      Pre-coded
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Ready
                  </span>
                </div>
                <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-[1.65rem] truncate">
                  {fileName ?? "Document"}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Classification complete — review groups and export your declaration file.
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            <a
              href={downloadHref}
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
            >
              <svg
                aria-hidden
                className="h-4 w-4 transition-transform group-hover:scale-110"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              {exportLabel}
            </a>
            <Link
              href="/dashboard/upload"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Upload another
            </Link>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="relative border-t border-slate-100/80 bg-slate-50/50 px-5 py-4 sm:px-7">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCell label="Line items" value={itemCount} accent="indigo" />
          <KpiCell label="HS groups" value={groupCount} accent="violet" />
          <KpiCell
            label="Needs review"
            value={reviewCount}
            accent={reviewCount > 0 ? "amber" : "slate"}
            highlight={reviewCount > 0}
          />
          <KpiCell label="Status" value="Complete" accent="emerald" isText />
        </div>
      </div>
    </div>
  );
}

function KpiCell({
  label,
  value,
  accent,
  highlight = false,
  isText = false,
}: {
  label: string;
  value: number | string;
  accent: "indigo" | "violet" | "amber" | "emerald" | "slate";
  highlight?: boolean;
  isText?: boolean;
}) {
  const valueColors: Record<string, string> = {
    indigo: "text-indigo-700",
    violet: "text-violet-700",
    amber: "text-amber-700",
    emerald: "text-emerald-700",
    slate: "text-slate-700",
  };

  return (
    <div
      className={`rounded-2xl border px-4 py-3 transition-colors ${
        highlight
          ? "border-amber-200/80 bg-amber-50/80"
          : "border-slate-200/60 bg-white/80"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className={`mt-0.5 font-bold tabular-nums ${valueColors[accent]} ${
          isText ? "text-base" : "text-2xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
