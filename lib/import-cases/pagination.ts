/**
 * Pure pagination helpers (no React, no DB) so they can be unit-tested offline.
 * Pages are 1-based. An empty list still has one (empty) page.
 */

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

/** A page number, or a gap marker rendered as an ellipsis. */
export type PageItem = number | "ellipsis-start" | "ellipsis-end";

export type PageBounds = {
  /** Current page after clamping into [1, pageCount]. */
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  /** 0-based slice start (inclusive). */
  start: number;
  /** 0-based slice end (exclusive). */
  end: number;
  /** 1-based first row shown (0 when the list is empty). */
  from: number;
  /** 1-based last row shown (0 when the list is empty). */
  to: number;
};

function toPositiveInt(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback;
}

export function normalizePageSize(pageSize: number): number {
  return toPositiveInt(pageSize, DEFAULT_PAGE_SIZE);
}

export function getPageCount(total: number, pageSize: number): number {
  const size = normalizePageSize(pageSize);
  const count = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  return Math.max(1, Math.ceil(count / size));
}

export function clampPage(page: number, pageCount: number): number {
  const last = Math.max(1, Math.floor(pageCount) || 1);
  const p = toPositiveInt(page, 1);
  return Math.min(p, last);
}

export function getPageBounds(
  total: number,
  page: number,
  pageSize: number,
): PageBounds {
  const size = normalizePageSize(pageSize);
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const pageCount = getPageCount(safeTotal, size);
  const current = clampPage(page, pageCount);
  const start = Math.min((current - 1) * size, safeTotal);
  const end = Math.min(start + size, safeTotal);
  return {
    page: current,
    pageCount,
    pageSize: size,
    total: safeTotal,
    start,
    end,
    from: safeTotal === 0 ? 0 : start + 1,
    to: end,
  };
}

export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): { items: T[]; bounds: PageBounds } {
  const bounds = getPageBounds(items.length, page, pageSize);
  return { items: items.slice(bounds.start, bounds.end), bounds };
}

/**
 * Page buttons with ellipses, e.g. 1 ... 4 5 6 ... 20.
 * Always returns the same number of slots once there are enough pages, so the
 * control does not jump around while paging.
 */
export function getPageRange(
  page: number,
  pageCount: number,
  siblings = 1,
): PageItem[] {
  const last = Math.max(1, Math.floor(pageCount) || 1);
  const current = clampPage(page, last);
  const sib = Math.max(0, Math.floor(siblings) || 0);

  // first + last + current + 2 siblings sets + 2 ellipses
  const slots = sib * 2 + 5;
  if (last <= slots) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }

  const left = Math.max(current - sib, 1);
  const right = Math.min(current + sib, last);
  // only use an ellipsis when it hides at least two pages
  const showLeftEllipsis = left > 3;
  const showRightEllipsis = right < last - 2;
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftCount = 3 + 2 * sib;
    return [...range(1, leftCount), "ellipsis-end", last];
  }
  if (showLeftEllipsis && !showRightEllipsis) {
    const rightCount = 3 + 2 * sib;
    return [1, "ellipsis-start", ...range(last - rightCount + 1, last)];
  }
  return [
    1,
    "ellipsis-start",
    ...range(left, right),
    "ellipsis-end",
    last,
  ];
}

/** "Showing 26-50 of 112" (en dash). Empty list reads "Showing 0 of 0". */
export function formatShowing(bounds: PageBounds, itemLabel = "lines"): string {
  if (bounds.total === 0) return `Showing 0 of 0 ${itemLabel}`;
  return `Showing ${bounds.from}\u2013${bounds.to} of ${bounds.total} ${itemLabel}`;
}