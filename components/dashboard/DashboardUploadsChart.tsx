type DayPoint = {
  label: string;
  count: number;
};

export function DashboardUploadsChart({ data }: { data: DayPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const chartH = 140;

  return (
    <div className="w-full">
      <div
        className="flex items-end justify-between gap-1 sm:gap-2"
        style={{ height: chartH }}
        role="img"
        aria-label="Uploads per day for the last 7 days"
      >
        {data.map((day) => {
          const h = max > 0 ? Math.round((day.count / max) * (chartH - 24)) : 0;
          const barH = Math.max(day.count > 0 ? 8 : 4, h);
          return (
            <div
              key={day.label}
              className="flex flex-1 flex-col items-center justify-end min-w-0"
            >
              <span className="text-[10px] sm:text-xs font-semibold text-gray-700 tabular-nums mb-1.5">
                {day.count > 0 ? day.count : ""}
              </span>
              <div
                className="w-full max-w-[48px] rounded-t-md bg-gradient-to-t from-[#0069d9] to-[#007bff] transition-all"
                style={{ height: barH }}
                title={`${day.label}: ${day.count} upload${day.count === 1 ? "" : "s"}`}
              />
            </div>
          );
        })}
      </div>
      <div
        className="mt-3 flex justify-between gap-1 border-t border-gray-100 pt-3"
        style={{ paddingLeft: 0, paddingRight: 0 }}
      >
        {data.map((day) => (
          <span
            key={`${day.label}-x`}
            className="flex-1 text-center text-[10px] sm:text-xs text-gray-500 truncate min-w-0"
          >
            {day.label}
          </span>
        ))}
      </div>
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
