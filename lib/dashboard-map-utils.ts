import {
  DESTINATION_ISO2,
  getCountryMeta,
  normalizeCountryCode,
} from "@/lib/country-codes";

/**
 * Pure helpers for the "Cases by source country" map.
 * Source country of a case = country of export, else supplier country, else
 * country of origin (resolved in SQL), then normalised here to ISO alpha-2.
 */

export type RawCountryCount = { code: string | null; count: number };
export type RawCountryWeek = {
  code: string | null;
  weeksAgo: number;
  count: number;
};

export type SourceCountry = {
  iso2: string;
  iso3: string;
  name: string;
  count: number;
  /** Share of cases that have a usable source country, 0-100. */
  share: number;
  x: number;
  y: number;
  hasShape: boolean;
};

export type SourceCountrySummary = {
  /** Sorted by case count (desc), then name. */
  countries: SourceCountry[];
  /** Cases with a usable source country. */
  total: number;
  /** Cases with no country on file, or a code we cannot recognise. */
  unknownCount: number;
  max: number;
};

export function summarizeSourceCountries(
  rows: RawCountryCount[],
): SourceCountrySummary {
  const merged = new Map<string, number>();
  let unknownCount = 0;
  for (const row of rows) {
    const iso2 = normalizeCountryCode(row.code);
    if (!iso2) {
      unknownCount += row.count;
      continue;
    }
    merged.set(iso2, (merged.get(iso2) ?? 0) + row.count);
  }

  let total = 0;
  for (const n of merged.values()) total += n;

  const countries: SourceCountry[] = [];
  for (const [iso2, count] of merged) {
    const meta = getCountryMeta(iso2);
    if (!meta) continue;
    countries.push({
      iso2: meta.iso2,
      iso3: meta.iso3,
      name: meta.name,
      count,
      share: total > 0 ? (count / total) * 100 : 0,
      x: meta.x,
      y: meta.y,
      hasShape: meta.hasShape,
    });
  }
  countries.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    countries,
    total,
    unknownCount,
    max: countries.reduce((m, c) => Math.max(m, c.count), 0),
  };
}

/** Fill opacity of the brand blue for each intensity step (1 = fewest cases). */
export const STEP_OPACITY = [0.28, 0.5, 0.75, 1] as const;

export function intensityStep(count: number, max: number): 1 | 2 | 3 | 4 {
  if (max <= 0 || count <= 0) return 1;
  const ratio = count / max;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

export function formatShare(share: number): string {
  if (share > 0 && share < 1) return "<1%";
  return `${Math.round(share)}%`;
}

/** Marker diameter in px, scaled by the square root of the case count. */
export function markerSize(count: number, max: number): number {
  const ratio = max > 0 ? Math.sqrt(Math.max(0, count) / max) : 0;
  return Math.round(12 + ratio * 14);
}

/** Quadratic arc from a source to the destination, bowed upwards. */
export function arcPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (!Number.isFinite(dist) || dist < 18) return null;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const cy = Math.max(6, my - dist * 0.28);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${mx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/** Cases per rolling 7-day window for one country, oldest first. */
export function weeklySeries(
  rows: RawCountryWeek[],
  iso2: string,
  weeks = 8,
): number[] {
  const out = new Array<number>(weeks).fill(0);
  for (const row of rows) {
    if (normalizeCountryCode(row.code) !== iso2) continue;
    if (row.weeksAgo < 0 || row.weeksAgo >= weeks) continue;
    out[weeks - 1 - row.weeksAgo] += row.count;
  }
  return out;
}

export { DESTINATION_ISO2 };