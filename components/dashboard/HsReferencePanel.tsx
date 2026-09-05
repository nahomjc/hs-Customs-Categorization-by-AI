"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { HsCodeBadge } from "@/components/dashboard/document/HsCodeBadge";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";
import {
  DashButton,
  DashCard,
  DashCardHeader,
  DashTable,
  DashTableEmpty,
  DashTableHead,
  DashTableHeaderRow,
  DashTbody,
  DashTd,
  DashTh,
  DashTr,
  dashInputClass,
  dashSelectClass,
} from "@/components/dashboard/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBytes } from "@/lib/formatBytes";
import type { HsReferenceSortField } from "@/lib/hsReferenceTypes";

type HsReferenceStats = {
  rowCount: number;
  chapters: string[];
  chapterRange: string | null;
  lastImportedAt: string | null;
  storageBytes: number;
};

type HsReferenceRow = {
  id: string;
  heading: string | null;
  hsCode: string | null;
  tariffNo: string;
  description: string;
  stdUnit: string | null;
  dutyRate: string | null;
  chapter: string | null;
  normalizedHs: string | null;
};

const PAGE_SIZES = [25, 50, 100] as const;

const SORTABLE_COLUMNS: {
  key: HsReferenceSortField;
  label: string;
}[] = [
  { key: "heading", label: "Heading" },
  { key: "hsCode", label: "HS Code" },
  { key: "tariffNo", label: "Tariff" },
  { key: "description", label: "Description" },
  { key: "dutyRate", label: "Duty" },
];

function SortIndicator({
  active,
  sortOrder,
}: {
  active: boolean;
  sortOrder: "asc" | "desc";
}) {
  if (!active) return <span className="ml-1 text-slate-300">↕</span>;
  return (
    <span className="ml-1 text-indigo-600">
      {sortOrder === "asc" ? "↑" : "↓"}
    </span>
  );
}

function formatImportedAt(value: string | null | undefined): string {
  if (!value) return "Not imported yet";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function HsReferencePanel() {
  const [stats, setStats] = useState<HsReferenceStats | null>(null);
  const [rows, setRows] = useState<HsReferenceRow[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [chapter, setChapter] = useState("");
  const [sortBy, setSortBy] = useState<HsReferenceSortField>("tariffNo");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (chapter) params.set("chapter", chapter);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/dashboard/hs-reference?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load reference data");

      setStats(data.stats);
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
      if (data.page && data.page !== page) {
        setPage(data.page);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [chapter, debouncedSearch, page, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onSort = (column: HsReferenceSortField) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const onChapterChange = (value: string) => {
    setChapter(value);
    setPage(1);
  };

  const onPageSizeChange = (value: number) => {
    setPageSize(value);
    setPage(1);
  };

  const acceptFile = (f: File | undefined) => {
    if (!f) return;
    const name = f.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      setUploadError("Please upload an Excel file (.xlsx or .xls)");
      return;
    }
    setFile(f);
    setUploadError(null);
  };

  const closeUploadModal = () => {
    if (uploading) return;
    setUploadModalOpen(false);
    setFile(null);
    setUploadError(null);
    setDragActive(false);
  };

  const onUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/dashboard/hs-reference/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast.success(
        `Upserted ${data.imported} rows (${data.inserted ?? data.imported} new, ${data.updated ?? 0} updated)`,
      );
      setFile(null);
      setUploadModalOpen(false);
      await loadData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed";
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_8px_40px_-12px_rgba(15,23,42,0.1)]">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="absolute -bottom-16 left-1/4 h-44 w-44 rounded-full bg-indigo-400/10 blur-3xl" />
        </div>
        <div className="relative px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">
                Admin · Reference data
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                HS tariff reference
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
                Upload the Ethiopian combined tariff book. Classification uses these codes as the allowed reference list — rows merge by tariff number.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
              <DashButton type="button" onClick={() => setUploadModalOpen(true)}>
                Import tariff book
              </DashButton>
              <div className="flex items-center gap-2 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                <svg className="h-5 w-5 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Partial books only cover imported chapters. Upload the full book for 94xx furniture codes.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Tariff rows"
          value={stats?.rowCount ?? "—"}
          hint="In database"
          accent="blue"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />
        <DashboardStatCard
          label="Chapter range"
          value={stats?.chapterRange ?? "—"}
          hint={`${stats?.chapters?.length ?? 0} chapters loaded`}
          accent="violet"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          }
        />
        <DashboardStatCard
          label="Storage"
          value={stats ? formatBytes(stats.storageBytes) : "—"}
          hint="Data + indexes"
          accent="default"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
          }
        />
        <DashboardStatCard
          label="Last import"
          value={stats?.lastImportedAt ? "Synced" : "—"}
          hint={formatImportedAt(stats?.lastImportedAt)}
          accent={stats?.lastImportedAt ? "green" : "default"}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        />
      </div>

      <Dialog
        open={uploadModalOpen}
        onOpenChange={(open) => {
          if (open) {
            setUploadModalOpen(true);
          } else {
            closeUploadModal();
          }
        }}
      >
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-slate-100 px-6 py-5 text-left">
            <DialogTitle>Upload tariff book</DialogTitle>
            <DialogDescription>
              Expected columns: Heading, H.S. Code, Tariff No., Description, Std.
              Unit, Duty Rate. Existing tariff numbers are updated; new rows are
              added without deleting other chapters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                acceptFile(e.dataTransfer.files[0]);
              }}
              className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
                dragActive
                  ? "border-indigo-400 bg-indigo-50/50"
                  : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
              }`}
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <title>Upload</title>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <p className="font-semibold text-slate-900">
                {file ? file.name : "Drag & drop Excel tariff book"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : ".xlsx or .xls"}
              </p>
              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
                Browse file
                <input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => acceptFile(e.target.files?.[0])}
                />
              </label>
            </div>

            {uploadError ? (
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                {uploadError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
            {file && !uploading ? (
              <DashButton type="button" variant="secondary" onClick={() => setFile(null)}>
                Remove file
              </DashButton>
            ) : null}
            <DashButton type="button" variant="secondary" onClick={closeUploadModal} disabled={uploading}>
              Cancel
            </DashButton>
            <DashButton type="button" onClick={() => void onUpload()} disabled={!file || uploading}>
              {uploading ? "Importing…" : "Import to database"}
            </DashButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Browse table */}
      <DashCard>
        <DashCardHeader
          title="Browse reference"
          action={
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600">
              {total.toLocaleString()} rows
            </span>
          }
        />
        <div className="space-y-4 px-5 py-4 sm:px-6">
          {error ? (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search HS, tariff, description…"
                className={`${dashInputClass} border-slate-200/80 bg-slate-50/50 focus:bg-white`}
              />
            </div>
            <select
              value={chapter}
              onChange={(e) => onChapterChange(e.target.value)}
              className={`${dashSelectClass} border-slate-200/80 bg-slate-50/50`}
            >
              <option value="">All chapters</option>
              {(stats?.chapters ?? []).map((ch) => (
                <option key={ch} value={ch}>
                  Chapter {ch}
                </option>
              ))}
            </select>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className={`${dashSelectClass} border-slate-200/80 bg-slate-50/50`}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-500">
            <p>
              {loading
                ? "Loading…"
                : total === 0
                  ? "No matching rows"
                  : `Showing ${rangeStart}–${rangeEnd} of ${total.toLocaleString()}`}
            </p>
            {totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                loading={loading}
                onPageChange={setPage}
              />
            )}
          </div>
        </div>

        {!loading && total === 0 && stats?.rowCount === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="font-semibold text-slate-800">No reference rows yet</p>
            <p className="mt-1 text-sm text-slate-500">Upload a tariff book to populate the reference table.</p>
            <DashButton type="button" className="mt-4" onClick={() => setUploadModalOpen(true)}>
              Import tariff book
            </DashButton>
          </div>
        ) : !loading && total === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            No rows match your search or filter.
          </div>
        ) : (
          <div className="border-t border-gray-100">
            <DashTable>
              <DashTableHead>
                <DashTableHeaderRow>
                  {SORTABLE_COLUMNS.map((col) => (
                    <DashTh key={col.key} density="compact" className="px-4">
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className="inline-flex items-center text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-800"
                      >
                        {col.label}
                        <SortIndicator
                          active={sortBy === col.key}
                          sortOrder={sortOrder}
                        />
                      </button>
                    </DashTh>
                  ))}
                  <DashTh density="compact" className="px-4">
                    Unit
                  </DashTh>
                </DashTableHeaderRow>
              </DashTableHead>
              <DashTbody>
                {loading ? (
                  <DashTableEmpty colSpan={6}>
                    <span className="inline-flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Loading reference data…
                    </span>
                  </DashTableEmpty>
                ) : (
                  rows.map((row) => {
                    const hsDisplay = row.hsCode ?? row.normalizedHs;
                    return (
                      <DashTr key={row.id}>
                        <DashTd muted density="compact" className="px-4 tabular-nums">
                          {row.heading ?? "—"}
                        </DashTd>
                        <DashTd density="compact" className="px-4">
                          {hsDisplay ? (
                            <HsCodeBadge code={hsDisplay} />
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </DashTd>
                        <DashTd density="compact" className="px-4 font-mono text-sm font-semibold text-gray-800">
                          {row.tariffNo}
                        </DashTd>
                        <DashTd density="compact" className="max-w-md px-4">
                          <span className="line-clamp-2 leading-relaxed">
                            {row.description}
                          </span>
                        </DashTd>
                        <DashTd density="compact" className="px-4">
                          {row.dutyRate ? (
                            <span className="inline-flex rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                              {row.dutyRate}
                            </span>
                          ) : (
                            "—"
                          )}
                        </DashTd>
                        <DashTd muted density="compact" className="px-4">
                          {row.stdUnit ?? "—"}
                        </DashTd>
                      </DashTr>
                    );
                  })
                )}
              </DashTbody>
            </DashTable>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-end border-t border-slate-100 px-5 py-4 sm:px-6">
            <Pagination
              page={page}
              totalPages={totalPages}
              loading={loading}
              onPageChange={setPage}
            />
          </div>
        )}
      </DashCard>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  loading,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1 || loading}
        className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
      >
        Previous
      </button>
      <span className="tabular-nums text-slate-500">
        Page <span className="font-bold text-slate-800">{page}</span> of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages || loading}
        className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
