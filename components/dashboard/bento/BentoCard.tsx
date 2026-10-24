import Link from "next/link";
import type { ReactNode } from "react";
import { BentoIcon, type BentoIconName } from "@/components/dashboard/bento/icons";
import { RingChart, Sparkline, BENTO_COLORS } from "@/components/dashboard/bento/charts";

/** Flat bento card: soft border, rounded-2xl, no shadow. */
export function BentoCard({
  children,
  className = "",
  padded = true,
  label,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className={`min-w-0 rounded-2xl border border-slate-200/70 bg-white ${
        padded ? "p-5 sm:p-6" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function BentoCardHeader({
  title,
  action,
  inset = false,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  /** Use inside an unpadded card (e.g. around a table). */
  inset?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 ${
        inset ? "px-5 pt-5 sm:px-6 sm:pt-6" : ""
      } ${className}`}
    >
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      {action}
    </div>
  );
}

/** Read-only period chip shown in a card header (e.g. "Last 7 days"). */
export function PeriodPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
      <BentoIcon name="calendar" className="h-3.5 w-3.5 text-slate-400" />
      {children}
    </span>
  );
}

export function DeltaBadge({
  pct,
  invert = false,
}: {
  pct: number | null | undefined;
  /** Lower is better. */
  invert?: boolean;
}) {
  if (pct === null || pct === undefined) return null;
  const up = pct > 0;
  const good = invert ? !up : up;
  const tone = pct === 0 ? "text-slate-400" : good ? "text-emerald-600" : "text-red-500";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${tone}`}>
      {pct === 0 ? null : (
        <BentoIcon name={up ? "arrowUp" : "arrowDown"} className="h-3 w-3" strokeWidth={2.5} />
      )}
      {Math.abs(pct)}%
      <span className="sr-only"> compared with the previous period</span>
    </span>
  );
}

const TONES = {
  blue: "bg-blue-50 text-[#007bff]",
  green: "bg-emerald-50 text-emerald-600",
  slate: "bg-slate-100 text-slate-600",
  indigo: "bg-indigo-50 text-indigo-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
} as const;

export type BentoTone = keyof typeof TONES;

const TONE_COLORS: Record<BentoTone, string> = {
  blue: BENTO_COLORS.brand,
  green: BENTO_COLORS.success,
  slate: BENTO_COLORS.muted,
  indigo: BENTO_COLORS.indigo,
  amber: BENTO_COLORS.warning,
  red: BENTO_COLORS.danger,
};

/** Compact KPI: icon in a circular tint badge, big number, label, optional delta. */
export function KpiTile({
  label,
  value,
  icon,
  tone = "blue",
  hint,
  delta,
  invertDelta,
}: {
  label: string;
  value: string | number;
  icon: BentoIconName;
  tone?: BentoTone;
  hint?: string;
  delta?: number | null;
  invertDelta?: boolean;
}) {
  return (
    <BentoCard padded={false} className="flex items-center gap-4 p-4 sm:p-5">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${TONES[tone]}`}>
        <BentoIcon name={icon} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="truncate text-2xl font-bold tabular-nums tracking-tight text-slate-900">
            {value}
          </p>
          <DeltaBadge pct={delta} invert={invertDelta} />
        </div>
        <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
        {hint ? <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p> : null}
      </div>
    </BentoCard>
  );
}

/** KPI with a mini ring showing a percentage. */
export function KpiRingTile({
  label,
  value,
  percent,
  hint,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  percent: number;
  hint?: string;
  tone?: BentoTone;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <BentoCard padded={false} className="flex items-center gap-4 p-4 sm:p-5">
      <RingChart
        size={56}
        thickness={9}
        segments={[
          { label, value: pct, color: TONE_COLORS[tone] },
          { label: "Remaining", value: 100 - pct, color: "transparent" },
        ]}
        ariaLabel={`${label}: ${pct}%`}
        centerValue={`${pct}%`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-2xl font-bold tabular-nums tracking-tight text-slate-900">
          {value}
        </p>
        <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
        {hint ? <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p> : null}
      </div>
    </BentoCard>
  );
}

/** KPI with a sparkline on top of the number. */
export function KpiSparkTile({
  label,
  value,
  values,
  delta,
  hint,
  tone = "blue",
  invertDelta,
}: {
  label: string;
  value: string | number;
  values: number[];
  delta?: number | null;
  hint?: string;
  tone?: BentoTone;
  invertDelta?: boolean;
}) {
  return (
    <BentoCard padded={false} className="p-4 sm:p-5">
      <Sparkline
        values={values}
        color={TONE_COLORS[tone]}
        ariaLabel={`${label} trend: ${values.join(", ")}`}
        className="h-12 w-full"
      />
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <p className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">{value}</p>
        <DeltaBadge pct={delta} invert={invertDelta} />
      </div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
    </BentoCard>
  );
}

export const promoButtonClass =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#007bff] transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#007bff]";

/** CTA banner in the brand blue (same hue family as the primary buttons). */
export function PromoBanner({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-[#0069d9] via-[#007bff] to-[#3d9bff] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="min-w-0">
        <h2 className="text-base font-bold sm:text-lg">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-xl text-sm text-white/85">{description}</p>
        ) : null}
      </div>
      {action}
    </section>
  );
}

export function PromoLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={promoButtonClass}>
      {children}
    </Link>
  );
}

/** Linked list row: title + subtitle, status pill, chevron. */
export function BentoListRow({
  href,
  title,
  subtitle,
  pill,
}: {
  href: string;
  title: string;
  subtitle?: string;
  pill?: ReactNode;
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
        <BentoIcon name="chevron" className="h-4 w-4 shrink-0 text-slate-300" strokeWidth={2} />
      </Link>
    </li>
  );
}

export function BentoEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: BentoIconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#007bff]">
        <BentoIcon name={icon} className="h-6 w-6" />
      </div>
      <p className="text-sm font-bold text-slate-900">{title}</p>
      {description ? <p className="mt-1 max-w-xs text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
