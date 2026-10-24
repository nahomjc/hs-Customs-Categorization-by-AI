/**
 * Helpers for the bento-style dashboard / analytics cards.
 * All day arithmetic is done on YYYY-MM-DD keys in UTC so that the previous
 * period and the current period always line up bucket-for-bucket.
 */

export type OutcomeDayRow = {
  day: string;
  completed: number;
  inProgress: number;
  cancelled: number;
};

export type OutcomeSeries = {
  labels: string[];
  completed: number[];
  inProgress: number[];
  cancelled: number[];
  total: number[];
  granularity: "daily" | "weekly";
};

const DAY_MS = 86_400_000;

function keyToUtc(key: string): number {
  return new Date(`${key}T00:00:00Z`).getTime();
}

function utcToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function todayKeyUtc(): string {
  return utcToKey(Date.now());
}

export function shiftKey(key: string, days: number): string {
  return utcToKey(keyToUtc(key) + days * DAY_MS);
}

export function dayKeys(fromKey: string, toKey: string): string[] {
  const start = keyToUtc(fromKey);
  const end = keyToUtc(toKey);
  const keys: string[] = [];
  for (let t = start; t <= end; t += DAY_MS) keys.push(utcToKey(t));
  return keys;
}

function shortLabel(key: string, weekday: boolean): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    ...(weekday ? { weekday: "short" } : { month: "short", day: "numeric" }),
  });
}

/**
 * Builds per-bucket outcome counts for [fromKey, toKey]. Ranges longer than
 * 31 days are grouped into 7-day buckets that start on `fromKey`.
 */
export function buildOutcomeSeries(
  rows: OutcomeDayRow[],
  fromKey: string,
  toKey: string,
): OutcomeSeries {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const keys = dayKeys(fromKey, toKey);
  const weekly = keys.length > 31;
  const size = weekly ? 7 : 1;

  const series: OutcomeSeries = {
    labels: [],
    completed: [],
    inProgress: [],
    cancelled: [],
    total: [],
    granularity: weekly ? "weekly" : "daily",
  };

  for (let i = 0; i < keys.length; i += size) {
    let completed = 0;
    let inProgress = 0;
    let cancelled = 0;
    for (const key of keys.slice(i, i + size)) {
      const row = byDay.get(key);
      if (!row) continue;
      completed += row.completed;
      inProgress += row.inProgress;
      cancelled += row.cancelled;
    }
    series.labels.push(shortLabel(keys[i], !weekly && keys.length <= 7));
    series.completed.push(completed);
    series.inProgress.push(inProgress);
    series.cancelled.push(cancelled);
    series.total.push(completed + inProgress + cancelled);
  }

  return series;
}

export function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

/** Percentage change, or null when there is no baseline to compare against. */
export function pctChange(current: number, previous: number | null): number | null {
  if (previous === null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function fmt(n: number): string {
  return n.toFixed(1);
}

/** Smooth, non-overshooting line through the points (monotone cubic). */
export function smoothLinePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;

  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    m.push((pts[i + 1].y - pts[i].y) / dx[i]);
  }

  const t: number[] = new Array(n).fill(0);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      t[i] = tau * a * m[i];
      t[i + 1] = tau * b * m[i];
    }
  }

  let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i].x + dx[i] / 3;
    const c1y = pts[i].y + (t[i] * dx[i]) / 3;
    const c2x = pts[i + 1].x - dx[i] / 3;
    const c2y = pts[i + 1].y - (t[i + 1] * dx[i]) / 3;
    d += ` C ${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(pts[i + 1].x)} ${fmt(pts[i + 1].y)}`;
  }
  return d;
}
