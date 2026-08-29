const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bar: string }
> = {
  completed: {
    label: "Completed",
    color: "#10b981",
    bar: "bg-emerald-500",
  },
  ai_processed: {
    label: "AI processing",
    color: "#6366f1",
    bar: "bg-indigo-500",
  },
  parsed: { label: "Parsed", color: "#f59e0b", bar: "bg-amber-500" },
  uploaded: { label: "Uploaded", color: "#94a3b8", bar: "bg-slate-400" },
  failed: { label: "Failed", color: "#ef4444", bar: "bg-red-500" },
  grouped: { label: "Grouped", color: "#8b5cf6", bar: "bg-violet-500" },
};

const ORDER = [
  "completed",
  "ai_processed",
  "parsed",
  "uploaded",
  "grouped",
  "failed",
];

export type StatusCount = { status: string; count: number };

export function DashboardStatusChart({ items }: { items: StatusCount[] }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  const sorted = [...items].sort(
    (a, b) =>
      (ORDER.indexOf(a.status) === -1 ? 99 : ORDER.indexOf(a.status)) -
      (ORDER.indexOf(b.status) === -1 ? 99 : ORDER.indexOf(b.status)),
  );

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">
          No documents in this range yet.
        </p>
      </div>
    );
  }

  let cumulative = 0;
  const segments = sorted
    .filter((i) => i.count > 0)
    .map((item) => {
      const cfg = STATUS_CONFIG[item.status] ?? {
        label: item.status,
        color: "#94a3b8",
        bar: "bg-slate-400",
      };
      const pct = item.count / total;
      const start = cumulative;
      cumulative += pct;
      return { ...item, ...cfg, pct, start };
    });

  const r = 42;
  const c = 2 * Math.PI * r;

  function arcPath(startFrac: number, endFrac: number) {
    const start = startFrac * c;
    const end = endFrac * c;
    const large = end - start > c / 2 ? 1 : 0;
    const x1 = 50 + r * Math.cos((start / c) * 2 * Math.PI - Math.PI / 2);
    const y1 = 50 + r * Math.sin((start / c) * 2 * Math.PI - Math.PI / 2);
    const x2 = 50 + r * Math.cos((end / c) * 2 * Math.PI - Math.PI / 2);
    const y2 = 50 + r * Math.sin((end / c) * 2 * Math.PI - Math.PI / 2);
    return `M 50 50 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  }

  const completedPct =
    segments.find((s) => s.status === "completed")?.pct ?? 0;

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="relative mx-auto shrink-0 sm:mx-0">
        <svg
          viewBox="0 0 100 100"
          className="h-40 w-40 drop-shadow-sm"
          role="img"
          aria-label="Document status distribution"
        >
          <title>Status distribution</title>
          {segments.map((seg) => (
            <path
              key={seg.status}
              d={arcPath(seg.start, seg.start + seg.pct)}
              fill={seg.color}
              className="opacity-90 transition-opacity hover:opacity-100"
            />
          ))}
          <circle cx="50" cy="50" r="28" fill="white" />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-slate-900">
            {Math.round(completedPct * 100)}%
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Complete
          </span>
        </div>
      </div>

      <ul className="min-w-0 w-full flex-1 space-y-3">
        {segments.map((seg) => (
          <li key={seg.status}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-700">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: seg.color }}
                  aria-hidden
                />
                <span className="truncate">{seg.label}</span>
              </span>
              <span className="shrink-0 ml-2 tabular-nums font-bold text-slate-900">
                {seg.count}
                <span className="ml-1 font-normal text-slate-400">
                  ({Math.round(seg.pct * 100)}%)
                </span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${seg.bar}`}
                style={{ width: `${seg.pct * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
