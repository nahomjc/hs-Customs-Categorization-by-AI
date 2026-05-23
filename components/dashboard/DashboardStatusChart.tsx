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
    color: "#007bff",
    bar: "bg-[#007bff]",
  },
  parsed: { label: "Parsed", color: "#f59e0b", bar: "bg-amber-500" },
  uploaded: { label: "Uploaded", color: "#9ca3af", bar: "bg-gray-400" },
  failed: { label: "Failed", color: "#ef4444", bar: "bg-red-500" },
  grouped: { label: "Grouped", color: "#6366f1", bar: "bg-indigo-500" },
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
      <p className="text-sm text-gray-500 py-8 text-center">
        No documents yet — upload a packing list to see status breakdown.
      </p>
    );
  }

  // Donut segments
  let cumulative = 0;
  const segments = sorted
    .filter((i) => i.count > 0)
    .map((item) => {
      const cfg = STATUS_CONFIG[item.status] ?? {
        label: item.status,
        color: "#94a3b8",
        bar: "bg-gray-400",
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

  return (
    <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-stretch">
      <div className="relative shrink-0 mx-auto sm:mx-0">
        <svg
          viewBox="0 0 100 100"
          className="w-36 h-36 sm:w-40 sm:h-40"
          role="img"
          aria-label="Document status distribution"
        >
          <title>Status distribution</title>
          {segments.map((seg) => (
            <path
              key={seg.status}
              d={arcPath(seg.start, seg.start + seg.pct)}
              fill={seg.color}
              className="opacity-90 hover:opacity-100 transition-opacity"
            />
          ))}
          <circle cx="50" cy="50" r="26" fill="white" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-gray-900 tabular-nums">
            {total}
          </span>
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            Total
          </span>
        </div>
      </div>

      <ul className="flex-1 space-y-3 min-w-0 w-full">
        {segments.map((seg) => (
          <li key={seg.status}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-2 font-medium text-gray-700 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: seg.color }}
                  aria-hidden
                />
                <span className="truncate">{seg.label}</span>
              </span>
              <span className="text-gray-900 font-semibold tabular-nums shrink-0 ml-2">
                {seg.count}{" "}
                <span className="text-gray-400 font-normal">
                  ({Math.round(seg.pct * 100)}%)
                </span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
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
