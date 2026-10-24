import { BENTO_COLORS, type RingSegment } from "@/components/dashboard/bento/charts";

/**
 * Donut with one highlighted (thicker, labelled) segment, like the
 * "Data Categories" card in the reference. Flat, no JS.
 * The highlighted segment defaults to the largest one.
 */
export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  highlight,
  size = 176,
  thickness = 15,
  ariaLabel,
}: {
  segments: RingSegment[];
  centerValue?: string;
  centerLabel?: string;
  /** Label of the segment to emphasise. */
  highlight?: string;
  size?: number;
  thickness?: number;
  ariaLabel: string;
}) {
  const bump = 5;
  const r = 50 - (thickness + bump) / 2;
  const c = 2 * Math.PI * r;
  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((s, seg) => s + seg.value, 0);
  const top =
    highlight ??
    visible.reduce<RingSegment | null>(
      (best, seg) => (best && best.value >= seg.value ? best : seg),
      null,
    )?.label;
  const gap = visible.length > 1 ? 1.2 : 0;

  const arcs: {
    seg: RingSegment;
    len: number;
    start: number;
    mid: number;
    pct: number;
  }[] = [];
  let acc = 0;
  for (const seg of visible) {
    const share = total > 0 ? seg.value / total : 0;
    arcs.push({
      seg,
      len: Math.max(0, share * c - gap),
      start: acc * c,
      mid: acc + share / 2,
      pct: Math.round(share * 100),
    });
    acc += share;
  }
  // Draw the highlighted segment last so its thicker stroke sits on top.
  const ordered = [...arcs].sort(
    (a, b) => Number(a.seg.label === top) - Number(b.seg.label === top),
  );

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
        {ordered.map(({ seg, len, start }) => (
          <circle
            key={seg.label}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={seg.label === top ? thickness + bump : thickness}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-start}
            transform="rotate(-90 50 50)"
          />
        ))}
        {arcs
          .filter(({ seg, pct }) => seg.label === top && pct >= 6)
          .map(({ seg, mid, pct }) => {
            const a = mid * 2 * Math.PI - Math.PI / 2;
            return (
              <text
                key={`${seg.label}-pct`}
                x={50 + r * Math.cos(a)}
                y={50 + r * Math.sin(a)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="7"
                fontWeight="700"
                fill="#ffffff"
                aria-hidden="true"
              >
                {pct}%
              </text>
            );
          })}
      </svg>
      {centerValue ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold tabular-nums leading-none text-slate-900">
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

/** Square-swatch legend with value and share, left of the donut. */
export function DonutLegend({
  rows,
  highlight,
}: {
  rows: RingSegment[];
  highlight?: string;
}) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const top =
    highlight ??
    rows.reduce<RingSegment | null>(
      (best, row) => (best && best.value >= row.value ? best : row),
      null,
    )?.label;
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => {
        const share = total > 0 ? Math.round((row.value / total) * 100) : 0;
        const active = row.label === top && row.value > 0;
        return (
          <li key={row.label} className="flex items-center gap-2.5 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: row.color }}
              aria-hidden="true"
            />
            <span
              className={`min-w-0 flex-1 truncate ${
                active ? "font-bold text-slate-900" : "font-medium text-slate-600"
              }`}
            >
              {row.label}
            </span>
            <span className="shrink-0 tabular-nums text-slate-400">({share}%)</span>
            <span className="w-8 shrink-0 text-right font-bold tabular-nums text-slate-900">
              {row.value.toLocaleString()}
            </span>
          </li>
        );
      })}
    </ul>
  );
}