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
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  const max = Math.max(...rows.map((r) => r.count));

  return (
    <div className="space-y-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
        {title}
      </p>
      <ul className="space-y-4">
        {rows.map((row) => {
          const pct = Math.round((row.count / total) * 100);
          const width = max > 0 ? (row.count / max) * 100 : 0;
          return (
            <li key={row.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 font-semibold text-slate-800">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                    aria-hidden
                  />
                  {row.label}
                </span>
                <span className="tabular-nums text-slate-600">
                  <span className="font-bold text-slate-900">{row.count}</span>
                  <span className="ml-1 text-xs text-slate-400">({pct}%)</span>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${width}%`,
                    background: `linear-gradient(90deg, ${row.color}, ${row.color}cc)`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
