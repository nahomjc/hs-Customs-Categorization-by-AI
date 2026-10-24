import Link from "next/link";
import type { ReactNode } from "react";
import { BentoCard } from "@/components/dashboard/bento/BentoCard";
import { Sparkline } from "@/components/dashboard/bento/charts";
import { BentoIcon } from "@/components/dashboard/bento/icons";

/* -------------------------------------------------------------------------- */
/* Gradient hero                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Brand-blue gradient headline card (reference: "Total Earnings") with a big
 * number, optional secondary lines and a Details button.
 */
export function GradientHeroCard({
  title,
  caption,
  value,
  lines,
  href,
  actionLabel = "Details",
}: {
  title: string;
  caption?: string;
  value: string;
  /** Extra real figures shown under the number, e.g. invoice value per currency. */
  lines?: { label: string; value: string }[];
  href: string;
  actionLabel?: string;
}) {
  return (
    <section
      aria-label={title}
      className="relative flex min-w-0 flex-col justify-between gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0057b8] via-[#007bff] to-[#3d9bff] p-5 text-white sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-2 -bottom-2 h-24 w-32 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.85) 1.5px, transparent 1.6px)",
          backgroundSize: "12px 12px",
        }}
      />
      <div className="relative">
        <h2 className="text-sm font-bold">{title}</h2>
        {caption ? <p className="text-xs text-white/70">{caption}</p> : null}
        <p className="mt-3 truncate text-4xl font-bold tabular-nums tracking-tight sm:text-[2.5rem]">
          {value}
        </p>
        {lines && lines.length > 0 ? (
          <dl className="mt-3 space-y-0.5 text-xs">
            {lines.map((line) => (
              <div key={line.label} className="flex flex-wrap items-baseline gap-x-2">
                <dt className="text-white/70">{line.label}</dt>
                <dd className="font-semibold tabular-nums">{line.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      <div className="relative">
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#007bff]"
        >
          {actionLabel}
          <BentoIcon name="chevron" className="h-3.5 w-3.5" strokeWidth={2.5} />
        </Link>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress KPI                                                                */
/* -------------------------------------------------------------------------- */

/** KPI with a progress bar and a big number badge (reference: "Task Order"). */
export function KpiProgressTile({
  label,
  badgeValue,
  percent,
  caption,
  hint,
}: {
  label: string;
  badgeValue: string | number;
  percent: number;
  caption: string;
  hint?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <BentoCard padded={false} className="flex items-center gap-3 p-4 sm:p-5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
        {hint ? <p className="truncate text-[11px] text-slate-400">{hint}</p> : null}
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        >
          <div className="h-full rounded-full bg-[#007bff]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 truncate text-xs text-slate-500">{caption}</p>
      </div>
      <div className="flex h-14 min-w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[#007bff] px-2 text-white">
        <span className="text-xl font-bold leading-none tabular-nums">{badgeValue}</span>
      </div>
    </BentoCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat list with sparklines                                                   */
/* -------------------------------------------------------------------------- */

export type StatListRow = {
  key: string;
  label: string;
  /** Big number. */
  value: string;
  /** Small text under the label, e.g. "42% of cases". */
  caption?: string;
  /** Trend values (oldest first). A flat share bar is shown when omitted or all zero. */
  series?: number[];
  /** 0-100, drives the fallback bar. */
  percent?: number;
  color: string;
};

/** Reference "Top Information data": left accent bar, number, label, trend line. */
export function StatList({ rows, trendLabel }: { rows: StatListRow[]; trendLabel: string }) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const hasTrend = !!row.series && row.series.some((v) => v > 0);
        return (
          <li
            key={row.key}
            className="flex items-center gap-3 rounded-xl bg-slate-50/80 py-3 pr-3 pl-0 sm:pr-4"
          >
            <span
              className="h-10 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold leading-tight tabular-nums text-slate-900">
                {row.value}
              </p>
              <p className="truncate text-xs font-semibold text-slate-500">{row.label}</p>
              {row.caption ? (
                <p className="truncate text-[11px] text-slate-400">{row.caption}</p>
              ) : null}
            </div>
            {hasTrend ? (
              <Sparkline
                values={row.series ?? []}
                color={row.color}
                ariaLabel={`${row.label}: ${trendLabel} ${(row.series ?? []).join(", ")}`}
                className="h-9 w-24 shrink-0"
              />
            ) : (
              <div
                className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-slate-200"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(4, Math.min(100, row.percent ?? 0))}%`,
                    backgroundColor: row.color,
                  }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Row with status pill and amount                                             */
/* -------------------------------------------------------------------------- */

export function AmountListRow({
  href,
  title,
  subtitle,
  pill,
  amount,
}: {
  href: string;
  title: string;
  subtitle?: string;
  pill?: ReactNode;
  /** Formatted amount, or null when the case has none on file. */
  amount: string | null;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#007bff]/40"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {pill}
        <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums text-slate-900">
          {amount ?? <span className="font-medium text-slate-300">&mdash;</span>}
        </span>
      </Link>
    </li>
  );
}