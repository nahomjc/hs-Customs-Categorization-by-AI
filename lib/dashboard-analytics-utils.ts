export type StatusCount = { status: string; count: number };

export type DayPoint = { label: string; count: number };

export type AnalyticsData = {
  totalCount: number;
  completedCount: number;
  inProgressCount: number;
  failedCount: number;
  statusBreakdown: StatusCount[];
  uploadsByDay: { day: string; count: number }[];
  fileTypeBreakdown: { fileType: string; count: number }[];
  modeBreakdown: { mode: string; count: number }[];
  recentInRange: {
    id: string;
    originalFileName: string | null;
    status: string | null;
    fileType: string | null;
    createdAt: Date | null;
  }[];
};

export function toDateKey(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

export function parseAnalyticsRange(params: {
  from?: string;
  to?: string;
}): { from: Date; to: Date; fromKey: string; toKey: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let to = today;
  if (params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to)) {
    to = new Date(`${params.to}T00:00:00`);
  }

  let from = new Date(to);
  from.setDate(from.getDate() - 29);

  if (params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from)) {
    from = new Date(`${params.from}T00:00:00`);
  }

  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }

  const maxSpan = 366;
  const spanDays = Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1;
  if (spanDays > maxSpan) {
    from = new Date(to);
    from.setDate(from.getDate() - (maxSpan - 1));
  }

  return {
    from,
    to,
    fromKey: toDateKey(from),
    toKey: toDateKey(to),
  };
}

export function buildDateRangeUploadSeries(
  rows: { day: string; count: number }[],
  from: Date,
  to: Date,
): DayPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  const dayCount =
    Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

  if (dayCount > 45) {
    const byWeek = new Map<string, number>();
    for (const [day, count] of byDay) {
      const d = new Date(`${day}T00:00:00`);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = toDateKey(weekStart);
      byWeek.set(key, (byWeek.get(key) ?? 0) + count);
    }
    const points: DayPoint[] = [];
    const cur = new Date(start);
    cur.setDate(cur.getDate() - cur.getDay());
    while (cur <= end) {
      const key = toDateKey(cur);
      points.push({
        label: cur.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        count: byWeek.get(key) ?? 0,
      });
      cur.setDate(cur.getDate() + 7);
    }
    return points.length > 0 ? points : [{ label: "—", count: 0 }];
  }

  const points: DayPoint[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const key = toDateKey(cur);
    const label =
      dayCount <= 7
        ? cur.toLocaleDateString("en-US", { weekday: "short" })
        : cur.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    points.push({ label, count: byDay.get(key) ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return points;
}

export function formatRangeLabel(fromKey: string, toKey: string): string {
  const from = new Date(`${fromKey}T00:00:00`);
  const to = new Date(`${toKey}T00:00:00`);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  if (fromKey === toKey) return from.toLocaleDateString("en-US", opts);
  return `${from.toLocaleDateString("en-US", opts)} – ${to.toLocaleDateString("en-US", opts)}`;
}
