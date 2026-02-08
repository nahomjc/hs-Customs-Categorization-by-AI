"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const STATUS_LABELS: Record<string, string> = {
  uploaded: "Uploaded",
  parsed: "Parsing",
  ai_processed: "Classifying",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "uploaded", label: "Uploaded" },
  { value: "parsed", label: "Parsing" },
  { value: "ai_processed", label: "Classifying" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
] as const;

function formatStatus(status: string | null): string {
  return STATUS_LABELS[status ?? "uploaded"] ?? status ?? "Uploaded";
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type Doc = {
  id: string;
  originalFileName: string | null;
  status: string | null;
  createdAt: Date | null;
};

type SortKey = "file" | "date" | "status";

export function HistoryTable({ list }: { list: Doc[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<Doc | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "date",
    dir: "desc",
  });

  const openDeleteDialog = (doc: Doc) => {
    setDocToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDocToDelete(null);
  };

  const deleteRow = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Delete failed");
      }
      closeDeleteDialog();
      router.refresh();
    } catch {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byStatus = statusFilter
      ? list.filter((d) => (d.status ?? "uploaded") === statusFilter)
      : list;
    if (!q) return byStatus;
    return byStatus.filter((d) => {
      const name = (d.originalFileName ?? "").toLowerCase();
      const dateStr = formatDate(d.createdAt).toLowerCase();
      return name.includes(q) || dateStr.includes(q);
    });
  }, [list, search, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case "file":
          cmp = (a.originalFileName ?? "").localeCompare(
            b.originalFileName ?? ""
          );
          break;
        case "date":
          cmp =
            new Date(a.createdAt ?? 0).getTime() -
            new Date(b.createdAt ?? 0).getTime();
          break;
        case "status":
          cmp = (a.status ?? "").localeCompare(b.status ?? "");
          break;
      }
      return sort.dir === "desc" ? -cmp : cmp;
    });
    return arr;
  }, [filtered, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((s) => ({
      key,
      dir: s.key === key && s.dir === "asc" ? "desc" : "asc",
    }));
  };

  const statusBadge = (s: string | null) => {
    const status = s ?? "uploaded";
    const styles: Record<string, string> = {
      uploaded: "bg-stone-100 text-stone-700",
      parsed: "bg-amber-100 text-amber-800",
      ai_processed: "bg-amber-100 text-amber-800",
      completed: "bg-emerald-100 text-emerald-800",
      failed: "bg-red-100 text-red-800",
    };
    const c = styles[status] ?? "bg-stone-100 text-stone-700";
    return (
      <span
        className={
          "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium " +
          c
        }
      >
        {formatStatus(status)}
      </span>
    );
  };

  return (
    <>
      <div className="bg-[var(--background-card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
        {/* Search + filter bar */}
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--background)]/50 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]/40 pointer-events-none"
              aria-hidden
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by file name or date…"
              className="w-full pl-9 pr-8 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
              aria-label="Search history"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-[var(--foreground)]/50 hover:text-[var(--foreground)] hover:bg-[var(--background)]"
                aria-label="Clear search"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm text-[var(--foreground)]/70 shrink-0">
              Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 pl-3 pr-8 text-sm border border-[var(--border)] rounded-lg bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-[var(--foreground)]/60 whitespace-nowrap">
              {sorted.length === list.length
                ? `${list.length} document${list.length !== 1 ? "s" : ""}`
                : `${sorted.length} of ${list.length}`}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--background)]/80 text-left border-b border-[var(--border)]">
                <th className="px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => toggleSort("file")}
                    className="font-semibold text-[var(--foreground)]/80 uppercase tracking-wider text-xs text-left flex items-center gap-1 hover:text-[var(--foreground)]"
                  >
                    File
                    {sort.key === "file" && (sort.dir === "asc" ? " ↑" : " ↓")}
                  </button>
                </th>
                <th className="px-5 py-3.5 w-40">
                  <button
                    type="button"
                    onClick={() => toggleSort("date")}
                    className="font-semibold text-[var(--foreground)]/80 uppercase tracking-wider text-xs text-left flex items-center gap-1 hover:text-[var(--foreground)]"
                  >
                    Date
                    {sort.key === "date" && (sort.dir === "asc" ? " ↑" : " ↓")}
                  </button>
                </th>
                <th className="px-5 py-3.5 w-28">
                  <button
                    type="button"
                    onClick={() => toggleSort("status")}
                    className="font-semibold text-[var(--foreground)]/80 uppercase tracking-wider text-xs text-left flex items-center gap-1 hover:text-[var(--foreground)]"
                  >
                    Status
                    {sort.key === "status" &&
                      (sort.dir === "asc" ? " ↑" : " ↓")}
                  </button>
                </th>
                <th className="px-5 py-3.5 font-semibold text-[var(--foreground)]/80 uppercase tracking-wider text-xs w-24 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-0">
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                      <div className="w-14 h-14 rounded-full bg-[var(--background)] flex items-center justify-center mb-4">
                        <svg
                          className="w-7 h-7 text-[var(--foreground)]/40"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <p className="font-semibold text-[var(--foreground)]">
                        No documents yet
                      </p>
                      <p className="mt-1 text-sm text-[var(--foreground)]/60 max-w-xs">
                        Upload a packing list from the Upload page to see it
                        here.
                      </p>
                      <Link
                        href="/dashboard/upload"
                        className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
                      >
                        Upload packing list
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-12 text-center text-[var(--foreground)]/60 text-sm"
                  >
                    No documents match your search or filter.
                  </td>
                </tr>
              ) : (
                sorted.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-t border-[var(--border-subtle)] hover:bg-[var(--background)]/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-[var(--foreground)] truncate block max-w-[240px] sm:max-w-none">
                        {doc.originalFileName ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[var(--foreground)]/70 whitespace-nowrap text-xs">
                      {formatDate(doc.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">{statusBadge(doc.status)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={"/dashboard/documents/" + doc.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--accent)] bg-[var(--accent-light)]/50 hover:bg-[var(--accent-light)] transition-colors"
                        >
                          View
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </Link>
                        <button
                          type="button"
                          onClick={() => openDeleteDialog(doc)}
                          disabled={deletingId === doc.id}
                          className="inline-flex items-center p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Delete"
                          aria-label="Delete document"
                        >
                          {deletingId === doc.id ? (
                            <svg
                              className="w-4 h-4 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                              aria-hidden
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => !open && closeDeleteDialog()}
      >
        <DialogContent showClose={!deletingId}>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
            <DialogDescription>
              {docToDelete ? (
                <>
                  &ldquo;{docToDelete.originalFileName ?? "Untitled"}&rdquo;
                  will be permanently removed. This cannot be undone.
                </>
              ) : (
                "This document will be permanently removed. This cannot be undone."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={closeDeleteDialog}
              disabled={!!deletingId}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--background)]/80 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => docToDelete && deleteRow(docToDelete.id)}
              disabled={!!deletingId}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deletingId ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
