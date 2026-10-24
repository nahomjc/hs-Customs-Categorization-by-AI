"use client";

import { useId, useState } from "react";
import { smoothLinePath } from "@/lib/dashboard-bento-utils";

export type TrendSeries = {
  name: string;
  color: string;
  values: number[];
  /** Soft gradient fill under the line. */
  fill?: boolean;
  dashed?: boolean;
};

const W = 600;
const H = 200;
const PAD_Y = 10;

function niceTicks(max: number): number[] {
  const step = Math.max(1, Math.ceil(Math.max(1, max) / 4));
  const count = Math.ceil(Math.max(1, max) / step);
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

export function AreaTrendChart({
  labels,
  series,
  ariaLabel,
  unit = "cases",
  height = 200,
  emptyMessage = "No activity in this period yet.",
}: {
  labels: string[];
  series: TrendSeries[];
  ariaLabel: string;
  unit?: string;
  height?: number;
  emptyMessage?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);

  const n = labels.length;
  const rawMax = Math.max(0, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(rawMax);
  const top = ticks[ticks.length - 1];

  if (n === 0 || rawMax === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-sm text-slate-500"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  const xAt = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const yAt = (v: number) => H - PAD_Y - (v / top) * (H - PAD_Y * 2);
  const pctX = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const pctY = (v: number) => (yAt(v) / H) * 100;

  const paths = series.map((s) => {
    const pts = s.values.slice(0, n).map((v, i) => ({ x: xAt(i), y: yAt(v) }));
    const line = smoothLinePath(pts);
    const area =
      pts.length > 1 ? `${line} L ${xAt(n - 1)} ${H} L ${xAt(0)} ${H} Z` : "";
    return { line, area };
  });

  const labelStep = Math.max(1, Math.ceil(n / 7));

  const setFromPointer = (clientX: number, rect: DOMRect) => {
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setActive(n === 1 ? 0 : Math.round(frac * (n - 1)));
  };

  const tipPct = active === null ? 0 : Math.min(86, Math.max(14, pctX(active)));

  return (
    <div>
      <div className="flex gap-2">
        <div
          className="relative w-7 shrink-0 text-right text-[10px] font-semibold tabular-nums text-slate-400"
          style={{ height }}
          aria-hidden="true"
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${(yAt(t) / H) * 100}%` }}
            >
              {t}
            </span>
          ))}
        </div>

        <div
          className="relative min-w-0 flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007bff]/40"
          style={{ height }}
          tabIndex={0}
          role="group"
          aria-label={`${ariaLabel}. Use the left and right arrow keys to read each point.`}
          onPointerMove={(e) => setFromPointer(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              setActive((a) => (a === null ? 0 : Math.min(n - 1, a + 1)));
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              setActive((a) => (a === null ? n - 1 : Math.max(0, a - 1)));
            } else if (e.key === "Escape") {
              setActive(null);
            }
          }}
        >
          {ticks.map((t) => (
            <div
              key={t}
              className={`absolute inset-x-0 border-t ${
                t === 0 ? "border-slate-200" : "border-dashed border-slate-200/80"
              }`}
              style={{ top: `${(yAt(t) / H) * 100}%` }}
              aria-hidden="true"
            />
          ))}

          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.name} id={`${uid}-g${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
                </linearGradient>
              ))}
            </defs>
            {series.map((s, i) =>
              s.fill && paths[i].area ? (
                <path key={`${s.name}-area`} d={paths[i].area} fill={`url(#${uid}-g${i})`} />
              ) : null,
            )}
            {series.map((s, i) => (
              <path
                key={`${s.name}-line`}
                d={paths[i].line}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={s.dashed ? "6 6" : undefined}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {active !== null ? (
            <>
              <div
                className="pointer-events-none absolute inset-y-0 w-px bg-slate-300"
                style={{ left: `${pctX(active)}%` }}
                aria-hidden="true"
              />
              {series.map((s) => (
                <span
                  key={`${s.name}-dot`}
                  className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white"
                  style={{
                    left: `${pctX(active)}%`,
                    top: `${pctY(s.values[active] ?? 0)}%`,
                    borderColor: s.color,
                  }}
                  aria-hidden="true"
                />
              ))}
              <div
                className="pointer-events-none absolute top-0 z-20 -translate-x-1/2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2"
                style={{ left: `${tipPct}%` }}
                role="status"
              >
                <p className="text-[10px] font-semibold text-slate-500">{labels[active]}</p>
                {series.map((s) => (
                  <p key={s.name} className="flex items-center gap-1.5 text-xs text-slate-700">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                      aria-hidden="true"
                    />
                    {s.name}:{" "}
                    <span className="font-bold tabular-nums text-slate-900">
                      {s.values[active] ?? 0}
                    </span>
                  </p>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex gap-2" aria-hidden="true">
        <div className="w-7 shrink-0" />
        <div className="relative h-4 min-w-0 flex-1">
          {labels.map((label, i) =>
            i % labelStep === 0 ? (
              <span
                key={`${label}-${i}`}
                className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-slate-400"
                style={{
                  left: `${Math.min(96, Math.max(4, pctX(i)))}%`,
                }}
              >
                {label}
              </span>
            ) : null,
          )}
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            {s.name}
          </li>
        ))}
      </ul>

      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {series.map((s) => (
              <th key={s.name} scope="col">
                {s.name} ({unit})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={`${label}-${i}-row`}>
              <th scope="row">{label}</th>
              {series.map((s) => (
                <td key={s.name}>{s.values[i] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
