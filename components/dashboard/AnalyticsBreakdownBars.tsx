type Row = { label: string; count: number; color: string };

export function AnalyticsBreakdownBars({
  title,
  rows,
  emptyMessage,
}: {
  title: string;
  rows: Row[];
  emptyMessage: string;
}) {
  const total = rows.reduce((s, r) => s + r.count, 0);

  if (total === 0) {
    return (
      <p className="text-sm text-gray-500 py-6 text-center">{emptyMessage}</p>
    );
  }

  const max = Math.max(...rows.map((r) => r.count));

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {title}
      </p>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-gray-800">{row.label}</span>
              <span className="text-gray-600 tabular-nums">
                {row.count}{" "}
                <span className="text-gray-400 text-xs">
                  ({Math.round((row.count / total) * 100)}%)
                </span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${max > 0 ? (row.count / max) * 100 : 0}%`,
                  backgroundColor: row.color,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
