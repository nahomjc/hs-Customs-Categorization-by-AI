"use client";

import { useState } from "react";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  formatShowing,
  getPageBounds,
  getPageRange,
  type PageBounds,
} from "@/lib/import-cases/pagination";

/**
 * Client-side pagination state. The page is clamped, so when the list shrinks
 * (for example after a refresh) the user is never left on an empty page.
 * Call `reset()` when a filter or search changes to go back to page 1.
 */
export function usePagination(total: number, initialPageSize = DEFAULT_PAGE_SIZE) {
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [requestedPage, setPage] = useState(1);
  const bounds = getPageBounds(total, requestedPage, pageSize);

  return {
    ...bounds,
    setPage,
    setPageSize: (size: number) => {
      setPageSizeState(size);
      setPage(1);
    },
    reset: () => setPage(1),
  };
}

type PaginationProps = {
  bounds: PageBounds;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** Plural noun used in "Showing x-y of N ...". */
  itemLabel?: string;
  pageSizeOptions?: readonly number[];
  /** Optional hint under the controls (for example what bulk actions cover). */
  note?: string;
  className?: string;
};

const buttonBase =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const buttonIdle =
  "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#007bff]/20";
const buttonActive = "border-[#007bff] bg-[#007bff] text-white";

/** Flat (no shadow) pagination bar shared by the invoice and packing steps. */
export function Pagination({
  bounds,
  onPageChange,
  onPageSizeChange,
  itemLabel = "lines",
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  note,
  className = "",
}: PaginationProps) {
  if (bounds.total === 0) return null;

  const smallest = Math.min(...pageSizeOptions);
  const showControls = bounds.total > smallest;
  const range = getPageRange(bounds.page, bounds.pageCount);

  return (
    <div
      className={`flex flex-col gap-3 border-t border-slate-100 px-5 py-3 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600" aria-live="polite">
          {formatShowing(bounds, itemLabel)}
        </p>

        {showControls ? (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span>Rows per page</span>
              <select
                value={bounds.pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="dash-native-select min-h-9 w-auto rounded-xl border border-gray-200 bg-white py-1.5 pl-3 pr-9 text-sm text-gray-900 focus:border-[#007bff] focus:outline-none focus:ring-[3px] focus:ring-[#007bff]/12"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <nav aria-label="Pagination" className="flex items-center gap-1">
              <button
                type="button"
                className={`${buttonBase} ${buttonIdle}`}
                onClick={() => onPageChange(bounds.page - 1)}
                disabled={bounds.page <= 1}
                aria-label="Previous page"
              >
                Prev
              </button>
              {range.map((item) =>
                typeof item === "number" ? (
                  <button
                    key={item}
                    type="button"
                    className={`${buttonBase} ${
                      item === bounds.page ? buttonActive : buttonIdle
                    }`}
                    onClick={() => onPageChange(item)}
                    aria-label={`Page ${item}`}
                    aria-current={item === bounds.page ? "page" : undefined}
                  >
                    {item}
                  </button>
                ) : (
                  <span
                    key={item}
                    aria-hidden
                    className="inline-flex h-9 min-w-6 items-center justify-center text-sm text-slate-400"
                  >
                    &hellip;
                  </span>
                ),
              )}
              <button
                type="button"
                className={`${buttonBase} ${buttonIdle}`}
                onClick={() => onPageChange(bounds.page + 1)}
                disabled={bounds.page >= bounds.pageCount}
                aria-label="Next page"
              >
                Next
              </button>
            </nav>
          </div>
        ) : null}
      </div>
      {note ? <p className="text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}