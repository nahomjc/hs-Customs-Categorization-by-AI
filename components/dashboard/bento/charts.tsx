import { smoothLinePath } from "@/lib/dashboard-bento-utils";

/** Theme-safe chart palette: brand blue first, then hues the dashboard already uses. */
export const BENTO_COLORS = {
  brand: "#007bff",
  indigo: "#6366f1",
  sky: "#0ea5e9",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  muted: "#94a3b8",
  track: "#e2e8f0",
} as const;

export type RingSegment = {
  label: string;
  value: number;
  color: string;
};

/* -------------------------------------------------------------------------- */
/* Ring / donut                                                                */
/* -------------------------------------------------------------------------- */

export function RingChart({
  segments,
  centerValue,
  centerLabel,
  size = 148,
  thickness = 10,
  ariaLabel,
}: {
  segments: RingSegment[];
  centerValue?: string;
  centerLabel?: string;
  size?: number;
  thickness?: number;
  ariaLabel: string;
}) {
  const r = 50 - thickness / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? 1.5 : 0;
  const arcs: { seg: RingSegment; len: number; start: number }[] = [];
  let acc = 0;
  for (const seg of visible) {
    const share = total > 0 ? seg.value / total : 0;
    arcs.push({ seg, len: Math.max(0, share * c - gap), start: acc * c });
    acc += share;
  }

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={ariaLabel}>
        <title>{ariaLabel}</title>
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={BENTO_COLORS.track}
          strokeWidth={thickness}
          opacity={0.6}
        />
        {arcs.map(({ seg, len, start }) => (
          <circle
            key={seg.label}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness}
            strokeLinecap="butt"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-start}
            transform="rotate(-90 50 50)"
          />
        ))}
      </svg>
      {centerValue ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span
            className={`font-bold tabular-nums leading-none text-slate-900 ${
              size < 80 ? "text-xs" : "text-2xl"
            }`}
          >
            {centerValue}
          </span>
          {centerLabel ? (
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {centerLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export type LegendRow = {
  label: string;
  value: number;
  color: string;
  /** Percentage change vs the previous period, when a baseline exists. */
  delta?: number | null;
  /** Lower is better (e.g. cancelled cases). */
  invertDelta?: boolean;
};

export function RingLegend({ rows }: { rows: LegendRow[] }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ul
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${Math.min(rows.length, 3)}, minmax(0, 1fr))` }}
    >
      {rows.map((row) => {
        const share = total > 0 ? Math.round((row.value / total) * 100) : 0;
        const hasDelta = row.delta !== null && row.delta !== undefined;
        const up = (row.delta ?? 0) > 0;
        const good = row.invertDelta ? !up : up;
        return (
          <li key={row.label} className="min-w-0 text-center">
            <span
              className="mx-auto mb-1.5 block h-1.5 w-full max-w-[3.5rem] rounded-full"
              style={{ backgroundColor: row.color }}
              aria-hidden="true"
            />
            <p className="truncate text-xs font-semibold text-slate-700">{row.label}</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
              {row.value.toLocaleString()}
              <span className="ml-1 text-[11px] font-medium text-slate-400">{share}%</span>
            </p>
            {hasDelta ? (
              <p
                className={`mt-0.5 text-[11px] font-semibold tabular-nums ${
                  row.delta === 0 ? "text-slate-400" : good ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {row.delta === 0 ? "0%" : `${up ? "+" : "-"}${Math.abs(row.delta ?? 0)}%`}
                <span className="sr-only"> compared with the previous period</span>
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Sparkline                                                                   */
/* -------------------------------------------------------------------------- */

export function Sparkline({
  values,
  color = BENTO_COLORS.brand,
  ariaLabel,
  className = "h-12 w-full",
}: {
  values: number[];
  color?: string;
  ariaLabel: string;
  className?: string;
}) {
  const W = 100;
  const H = 32;
  const pad = 3;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => ({
    x: values.length === 1 ? W / 2 : (i / (values.length - 1)) * W,
    y: H - pad - (v / max) * (H - pad * 2),
  }));
  const line = smoothLinePath(pts);
  const area =
    pts.length > 1
      ? `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`
      : "";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>
      {area ? <path d={area} fill={color} fillOpacity={0.1} /> : null}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Stacked bars                                                                */
/* -------------------------------------------------------------------------- */

export type BarSeries = { name: string; color: string; values: number[] };

export function StackedBarChart({
  labels,
  series,
  height = 190,
  ariaLabel,
  unit = "cases",
}: {
  labels: string[];
  /** Listed bottom-to-top. */
  series: BarSeries[];
  height?: number;
  ariaLabel: string;
  unit?: string;
}) {
  const totals = labels.map((_, i) => series.reduce((s, sr) => s + (sr.values[i] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const step = Math.max(1, Math.ceil(labels.length / 8));

  return (
    <div>
      <div className="flex gap-2">
        <div
          className="flex w-7 shrink-0 flex-col justify-between pb-0 text-right text-[10px] font-semibold tabular-nums text-slate-400"
          style={{ height }}
          aria-hidden="true"
        >
          <span>{max}</span>
          <span>{Math.round(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative min-w-0 flex-1" style={{ height }} aria-hidden="true">
          {[0, 50, 100].map((p) => (
            <div
              key={p}
              className="absolute inset-x-0 border-t border-dashed border-slate-200"
              style={{ top: `${p}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-1 sm:gap-1.5">
            {labels.map((label, i) => {
              const total = totals[i];
              return (
                <div
                  key={`${label}-${i}`}
                  className="group/bar relative flex h-full min-w-0 flex-1 items-end justify-center"
                >
                  <div
                    className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-left group-hover/bar:block"
                    style={{ bottom: `${(total / max) * 100}%` }}
                  >
                    <p className="text-[10px] font-semibold text-slate-500">{label}</p>
                    {series.map((sr) => (
                      <p key={sr.name} className="flex items-center gap-1.5 text-xs text-slate-700">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: sr.color }}
                        />
                        {sr.name}:{" "}
                        <span className="font-bold tabular-nums text-slate-900">
                          {sr.values[i] ?? 0}
                        </span>
                      </p>
                    ))}
                  </div>
                  {total > 0 ? (
                    <div
                      className="flex w-full max-w-[1.75rem] flex-col-reverse overflow-hidden rounded-t-lg transition-opacity group-hover/bar:opacity-90"
                      style={{ height: `${(total / max) * 100}%` }}
                    >
                      {series.map((sr) => {
                        const v = sr.values[i] ?? 0;
                        if (v <= 0) return null;
                        return (
                          <div
                            key={sr.name}
                            style={{ height: `${(v / total) * 100}%`, backgroundColor: sr.color }}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-px w-full max-w-[1.75rem] bg-slate-200" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-2 flex gap-2" aria-hidden="true">
        <div className="w-7 shrink-0" />
        <div className="flex min-w-0 flex-1 gap-1 sm:gap-1.5">
          {labels.map((label, i) => (
            <span
              key={`${label}-${i}-x`}
              className="min-w-0 flex-1 truncate text-center text-[10px] font-medium text-slate-400"
            >
              {i % step === 0 ? label : ""}
            </span>
          ))}
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {series.map((sr) => (
          <li key={sr.name} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: sr.color }}
              aria-hidden="true"
            />
            {sr.name}
          </li>
        ))}
      </ul>

      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {series.map((sr) => (
              <th key={sr.name} scope="col">
                {sr.name} ({unit})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={`${label}-${i}-row`}>
              <th scope="row">{label}</th>
              {series.map((sr) => (
                <td key={sr.name}>{sr.values[i] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
