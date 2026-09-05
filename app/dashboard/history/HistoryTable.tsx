"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DashCard,
  DashTable,
  DashTableAction,
  DashTableEmpty,
  DashTableHead,
  DashTableHeaderRow,
  DashTableToolbar,
  DashTbody,
  DashTd,
  DashTh,
  DashTr,
  StatusBadge,
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

  return (
    <>
      <DashCard>
        <DashTableToolbar className="bg-gray-50/50">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                aria-hidden
              >
                <svg
                  className="h-4 w-4"
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
                className={`${dashInputClass} pr-8`}
                aria-label="Search history"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Clear search"
                >
                  <svg
                    className="h-4 w-4"
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
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="shrink-0 text-sm text-gray-500">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={dashSelectClass}
                aria-label="Filter by status"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="whitespace-nowrap text-xs text-gray-500">
                {sorted.length === list.length
                  ? `${list.length} document${list.length !== 1 ? "s" : ""}`
                  : `${sorted.length} of ${list.length}`}
              </span>
            </div>
          </div>
        </DashTableToolbar>

        <DashTable>
          <DashTableHead>
            <DashTableHeaderRow>
              <DashTh>
                <button
                  type="button"
                  onClick={() => toggleSort("file")}
                  className="flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900"
                >
                  File
                  {sort.key === "file" && (sort.dir === "asc" ? " ↑" : " ↓")}
                </button>
              </DashTh>
              <DashTh className="w-40">
                <button
                  type="button"
                  onClick={() => toggleSort("date")}
                  className="flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900"
                >
                  Date
                  {sort.key === "date" && (sort.dir === "asc" ? " ↑" : " ↓")}
                </button>
              </DashTh>
              <DashTh className="w-28">
                <button
                  type="button"
                  onClick={() => toggleSort("status")}
                  className="flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900"
                >
                  Status
                  {sort.key === "status" &&
                    (sort.dir === "asc" ? " ↑" : " ↓")}
                </button>
              </DashTh>
              <DashTh align="right" className="w-24">
                Action
              </DashTh>
            </DashTableHeaderRow>
          </DashTableHead>
          <DashTbody>
            {list.length === 0 ? (
              <DashTableEmpty colSpan={4} className="p-0">
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#007bff]">
                    <svg
                      className="h-7 w-7 opacity-60"
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
                  <p className="font-semibold text-gray-900">No documents yet</p>
                  <p className="mt-1 max-w-xs text-sm text-gray-500">
                    Upload a packing list from the Upload page to see it here.
                  </p>
                  <Link
                    href="/dashboard/upload"
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#007bff] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-[#0069d9]"
                  >
                    Upload packing list
                  </Link>
                </div>
              </DashTableEmpty>
            ) : sorted.length === 0 ? (
              <DashTableEmpty colSpan={4}>
                No documents match your search or filter.
              </DashTableEmpty>
            ) : (
              sorted.map((doc) => (
                <DashTr key={doc.id}>
                  <DashTd className="text-gray-900">
                    <span className="block max-w-[240px] truncate font-medium sm:max-w-none">
                      {doc.originalFileName ?? "—"}
                    </span>
                  </DashTd>
                  <DashTd muted nowrap className="text-xs">
                    {formatDate(doc.createdAt)}
                  </DashTd>
                  <DashTd>
                    <StatusBadge
                      status={doc.status}
                      label={formatStatus(doc.status)}
                    />
                  </DashTd>
                  <DashTd align="right">
                    <div className="inline-flex items-center gap-2">
                      <DashTableAction href={`/dashboard/documents/${doc.id}`}>
                        View
                        <svg
                          className="h-3.5 w-3.5"
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
                      </DashTableAction>
                      <button
                        type="button"
                        onClick={() => openDeleteDialog(doc)}
                        disabled={deletingId === doc.id}
                        className="inline-flex items-center rounded-lg p-1.5 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Delete"
                        aria-label="Delete document"
                      >
                        {deletingId === doc.id ? (
                          <svg
                            className="h-4 w-4 animate-spin"
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
                            className="h-4 w-4"
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
                  </DashTd>
                </DashTr>
              ))
            )}
          </DashTbody>
        </DashTable>
      </DashCard>

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
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => docToDelete && deleteRow(docToDelete.id)}
              disabled={!!deletingId}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deletingId ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
