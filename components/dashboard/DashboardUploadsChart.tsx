type DayPoint = {
  label: string;
  count: number;
};

type ChartGeometry = {
  coords: Array<DayPoint & { x: number; y: number }>;
  linePath: string;
  areaPath: string;
  baselineY: number;
  gridYs: number[];
};

const CHART_W = 480;
const CHART_H = 140;
const PAD_X = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 8;

function buildChartGeometry(data: DayPoint[], max: number): ChartGeometry {
  const chartW = CHART_W - PAD_X * 2;
  const chartH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const baselineY = PAD_TOP + chartH;

  const coords = data.map((d, i) => {
    const x =
      PAD_X +
      (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
    const ratio = max > 0 ? d.count / max : 0;
    const y = PAD_TOP + chartH - ratio * chartH;
    return { ...d, x, y };
  });

  if (coords.length === 0) {
    return {
      coords: [],
      linePath: "",
      areaPath: "",
      baselineY,
      gridYs: [],
    };
  }

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${baselineY} L ${coords[0].x.toFixed(1)} ${baselineY} Z`;

  const gridYs = [0, 0.5, 1].map(
    (frac) => PAD_TOP + chartH - frac * chartH,
  );

  return { coords, linePath, areaPath, baselineY, gridYs };
}

function formatAxisValue(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}

export function DashboardUploadsChart({
  data,
  granularity = "daily",
}: {
  data: DayPoint[];
  granularity?: "daily" | "weekly";
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  const avg = data.length > 0 ? total / data.length : 0;
  const peak = data.reduce(
    (best, d) => (d.count > best.count ? d : best),
    { label: "—", count: 0 },
  );
  const allZero = total === 0;
  const { coords, linePath, areaPath, gridYs } = buildChartGeometry(
    data,
    max,
  );

  return (
    <div className="w-full">
      {/* Stat strip */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatChip label="Total uploads" value={String(total)} accent="indigo" />
        <StatChip
          label={granularity === "weekly" ? "Avg / week" : "Avg / day"}
          value={avg < 10 ? avg.toFixed(1) : String(Math.round(avg))}
          accent="violet"
        />
        <StatChip
          label="Peak"
          value={String(peak.count)}
          sub={peak.count > 0 ? peak.label : undefined}
          accent="slate"
        />
      </div>

      <div className="relative rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white p-4 sm:p-5">
        {allZero ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">No uploads in this period</p>
            <p className="mt-1 text-xs text-slate-500">Upload a packing list to see volume here.</p>
          </div>
        ) : (
          <>
            {/* Y-axis labels */}
            <div className="pointer-events-none absolute left-0 top-4 bottom-10 flex flex-col justify-between pr-1 text-[10px] font-semibold tabular-nums text-slate-400">
              <span>{formatAxisValue(max)}</span>
              <span>{formatAxisValue(max / 2)}</span>
              <span>0</span>
            </div>

            <div className="pl-6">
              <div className="relative">
                <svg
                  viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                  className="h-[168px] w-full"
                  role="img"
                  aria-label="Upload volume over time"
                  preserveAspectRatio="none"
                >
                  <title>Upload volume chart</title>
                  <defs>
                    <linearGradient id="uploadAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="uploadLineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#4f46e5" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                  </defs>

                  {gridYs.map((y, i) => (
                    <line
                      key={i}
                      x1={PAD_X}
                      y1={y}
                      x2={CHART_W - PAD_X}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeWidth={1}
                      strokeDasharray={i === gridYs.length - 1 ? "0" : "4 4"}
                    />
                  ))}

                  <path d={areaPath} fill="url(#uploadAreaGrad)" />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="url(#uploadLineGrad)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {coords.map((point) => (
                    <circle
                      key={`${point.label}-dot`}
                      cx={point.x}
                      cy={point.y}
                      r={4}
                      className="fill-white stroke-indigo-500 stroke-[2]"
                    />
                  ))}
                </svg>

                {/* Hover zones aligned to each data point */}
                <div className="absolute inset-0 flex items-stretch">
                  {coords.map((point) => {
                    const isPeak = point.count === peak.count && point.count > 0;
                    return (
                      <div
                        key={`${point.label}-zone`}
                        className="group/point relative flex-1"
                      >
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 opacity-0 transition-all duration-200 group-hover/point:opacity-100 group-hover/point:-translate-y-0.5">
                          <div className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-center shadow-lg shadow-slate-900/25 whitespace-nowrap">
                            <p className="text-[10px] font-medium text-slate-300">
                              {point.label}
                            </p>
                            <p className="text-sm font-bold tabular-nums text-white">
                              {point.count} upload{point.count === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`mx-auto h-full w-full max-w-[2rem] rounded-md transition-colors group-hover/point:bg-indigo-500/5 ${
                            isPeak ? "bg-violet-500/5" : ""
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-2 flex justify-between gap-0.5 border-t border-slate-100 pt-2">
                {coords.map((point) => {
                  const isPeak = point.count === peak.count && point.count > 0;
                  return (
                    <span
                      key={`${point.label}-axis`}
                      className={`min-w-0 flex-1 truncate text-center text-[10px] font-medium sm:text-[11px] ${
                        isPeak ? "font-bold text-indigo-600" : "text-slate-400"
                      }`}
                    >
                      {point.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: "indigo" | "violet" | "slate";
}) {
  const accents = {
    indigo: "border-indigo-100/80 bg-indigo-50/50 text-indigo-700",
    violet: "border-violet-100/80 bg-violet-50/50 text-violet-700",
    slate: "border-slate-200/80 bg-slate-50/80 text-slate-800",
  };

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${accents[accent]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold tabular-nums leading-tight">{value}</p>
      {sub ? (
        <p className="mt-0.5 truncate text-[10px] font-medium opacity-60">{sub}</p>
      ) : null}
    </div>
  );
}

export function buildLast7DaysUploadSeries(
  rows: { day: string; count: number }[],
): DayPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  const points: DayPoint[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.push({
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      count: byDay.get(key) ?? 0,
    });
  }

  return points;
}
