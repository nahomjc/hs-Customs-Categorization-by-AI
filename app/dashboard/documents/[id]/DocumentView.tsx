"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { startProcessingDocument } from "@/app/actions";
import { NEED_INFO_HS } from "@/lib/allowedHsCodes";
import { DocumentChat } from "./DocumentChat";

type Item = {
  id: string;
  rawLine: string | null;
  detectedDescription: string | null;
  detectedQuantity: number | null;
  detectedUnit: string | null;
  aiCategory: string | null;
  aiHsCode: string | null;
  cleanDescription: string | null;
};

type Grouped = {
  id: string;
  hsCode: string;
  category: string;
  finalDescription: string;
  totalQuantity: number;
  unit: string | null;
};

export function DocumentView(props: {
  documentId: string;
  status: string | null;
  fileName: string | null;
  items: Item[];
  grouped: Grouped[];
}) {
  const router = useRouter();
  const { documentId, fileName, items, grouped } = props;
  const [status, setStatus] = useState(props.status ?? "uploaded");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    totalItems: number;
    classifiedCount: number;
  } | null>(null);
  const [searchItems, setSearchItems] = useState("");
  const [searchGrouped, setSearchGrouped] = useState("");
  const [sortItems, setSortItems] = useState<{
    key: "description" | "qty" | "hs" | "category";
    dir: "asc" | "desc";
  }>({ key: "description", dir: "asc" });
  const [sortGrouped, setSortGrouped] = useState<{
    key: "hsCode" | "category" | "qty" | "description";
    dir: "asc" | "desc";
  }>({ key: "hsCode", dir: "asc" });
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    hsCode: string;
    category: string;
    finalDescription: string;
    totalQuantity: number;
    unit: string;
  }>({
    hsCode: "",
    category: "",
    finalDescription: "",
    totalQuantity: 0,
    unit: "PCS",
  });
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);

  const ADD_GROUP_ID = "new";
  const startEditGrouped = (g: Grouped) => {
    setEditingGroupId(g.id);
    setEditForm({
      hsCode: g.hsCode,
      category: g.category,
      finalDescription: g.finalDescription,
      totalQuantity: g.totalQuantity,
      unit: g.unit ?? "PCS",
    });
  };
  const startAddGrouped = () => {
    setEditingGroupId(ADD_GROUP_ID);
    setEditForm({
      hsCode: "",
      category: "",
      finalDescription: "",
      totalQuantity: 0,
      unit: "PCS",
    });
  };
  const cancelEditGrouped = () => {
    setEditingGroupId(null);
  };
  const saveGrouped = async (id: string) => {
    const isNew = id === ADD_GROUP_ID;
    const hsCode = editForm.hsCode.trim();
    const category = editForm.category.trim();
    if (isNew && (!hsCode || !category)) {
      toast.error("HS Code and Category are required.");
      return;
    }
    setSavingGroupId(id);
    try {
      const res = await fetch(`/api/documents/${documentId}/grouped`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isNew
            ? {
                hsCode: hsCode || undefined,
                category: category || undefined,
                finalDescription: editForm.finalDescription.trim() || "—",
                totalQuantity: editForm.totalQuantity,
                unit: editForm.unit.trim() || null,
              }
            : {
                id,
                hsCode: hsCode || undefined,
                category: category || undefined,
                finalDescription: editForm.finalDescription.trim(),
                totalQuantity: editForm.totalQuantity,
                unit: editForm.unit.trim() || null,
              }
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      setEditingGroupId(null);
      router.refresh();
      toast.success("Group saved successfully.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingGroupId(null);
    }
  };

  const itemDesc = (i: Item) =>
    i.cleanDescription ?? i.detectedDescription ?? i.rawLine ?? "";
  const filteredItems = useMemo(() => {
    const q = searchItems.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const desc = itemDesc(i).toLowerCase();
      const hs = (i.aiHsCode ?? "").toLowerCase();
      const cat = (i.aiCategory ?? "").toLowerCase();
      const qty = String(i.detectedQuantity ?? "");
      return (
        desc.includes(q) || hs.includes(q) || cat.includes(q) || qty.includes(q)
      );
    });
  }, [items, searchItems]);

  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortItems.key) {
        case "description":
          cmp = itemDesc(a).localeCompare(itemDesc(b));
          break;
        case "qty":
          cmp = (a.detectedQuantity ?? 0) - (b.detectedQuantity ?? 0);
          break;
        case "hs":
          cmp = (a.aiHsCode ?? "").localeCompare(b.aiHsCode ?? "");
          break;
        case "category":
          cmp = (a.aiCategory ?? "").localeCompare(b.aiCategory ?? "");
          break;
      }
      return sortItems.dir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [filteredItems, sortItems]);

  const filteredGrouped = useMemo(() => {
    const q = searchGrouped.trim().toLowerCase();
    if (!q) return grouped;
    return grouped.filter((g) => {
      return (
        g.hsCode.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        g.finalDescription.toLowerCase().includes(q) ||
        String(g.totalQuantity).includes(q)
      );
    });
  }, [grouped, searchGrouped]);

  const sortedGrouped = useMemo(() => {
    const list = [...filteredGrouped];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortGrouped.key) {
        case "hsCode":
          cmp = a.hsCode.localeCompare(b.hsCode);
          break;
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
        case "qty":
          cmp = a.totalQuantity - b.totalQuantity;
          break;
        case "description":
          cmp = a.finalDescription.localeCompare(b.finalDescription);
          break;
      }
      return sortGrouped.dir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [filteredGrouped, sortGrouped]);

  const toggleSortItems = (key: typeof sortItems.key) => {
    setSortItems((s) => ({
      key,
      dir: s.key === key && s.dir === "asc" ? "desc" : "asc",
    }));
  };
  const toggleSortGrouped = (key: typeof sortGrouped.key) => {
    setSortGrouped((s) => ({
      key,
      dir: s.key === key && s.dir === "asc" ? "desc" : "asc",
    }));
  };

  useEffect(() => {
    if (status !== "uploaded" || processing) return;
    let cancelled = false;
    const run = async () => {
      setProcessing(true);
      try {
        const r = await startProcessingDocument(documentId);
        if (cancelled) return;
        if (r.error) setError(r.error);
        else {
          setStatus("completed");
          router.refresh();
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setProcessing(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [documentId, status, processing, router]);

  useEffect(() => {
    if (status === "completed" || status === "failed" || processing) return;
    const t = setInterval(async () => {
      const r = await fetch("/api/documents/" + documentId + "/status");
      const d = await r.json();
      if (d.status) {
        setStatus(d.status);
        if (d.totalItems != null && d.classifiedCount != null)
          setProgress({
            totalItems: d.totalItems,
            classifiedCount: d.classifiedCount,
          });
        if (d.status === "completed") router.refresh();
      }
    }, 2000);
    return () => clearInterval(t);
  }, [documentId, status, processing, router]);

  if (status !== "completed" && status !== "failed") {
    const isClassifying =
      status === "ai_processed" && progress && progress.totalItems > 0;
    const steps = [
      { id: "read", label: "Reading document", active: status === "uploaded" },
      { id: "extract", label: "Extracting items", active: status === "parsed" },
      {
        id: "classify",
        label: isClassifying
          ? `AI classifying (${progress!.classifiedCount}/${
              progress!.totalItems
            })`
          : "AI classifying",
        active: status === "ai_processed",
      },
      { id: "group", label: "Grouping by HS code", active: false },
    ];
    const currentStepIndex = steps.findIndex((s) => s.active);
    const activeIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

    return (
      <div className="max-w-md mx-auto py-12">
        <div className="bg-[var(--background-card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent)]">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-[var(--foreground)]">
                  Processing your document
                </h2>
                <p className="text-sm text-[var(--foreground)]/60">
                  {isClassifying
                    ? "This may take a minute depending on list size."
                    : "Please wait while we prepare your file."}
                </p>
              </div>
            </div>
            <ul className="space-y-0" aria-label="Processing steps">
              {steps.map((step, i) => {
                const isDone = i < activeIndex;
                const isCurrent = i === activeIndex;
                return (
                  <li
                    key={step.id}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span
                      className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                        isCurrent
                          ? "bg-[var(--accent)] text-white"
                          : isDone
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-[var(--border)] text-[var(--foreground)]/50"
                      }`}
                      aria-hidden
                    >
                      {isDone ? (
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span
                      className={`text-sm ${
                        isCurrent
                          ? "text-[var(--foreground)] font-medium"
                          : isDone
                          ? "text-[var(--foreground)]/70"
                          : "text-[var(--foreground)]/50"
                      }`}
                    >
                      {step.label}
                    </span>
                    {isCurrent && (
                      <span
                        className="ml-auto h-1.5 w-12 rounded-full bg-[var(--accent-light)] overflow-hidden"
                        aria-hidden
                      >
                        <span
                          className="block h-full w-1/2 rounded-full bg-[var(--accent)] animate-pulse"
                          style={{ minWidth: "30%" }}
                        />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="px-6 py-3 bg-[var(--background)]/60 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--foreground)]/50">
              Do not close this page. You’ll be redirected when processing is
              complete.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || status === "failed") {
    return (
      <div className="max-w-md mx-auto py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:underline mb-6"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to dashboard
        </Link>
        <div className="bg-[var(--background-card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="font-semibold text-[var(--foreground)]">
              Processing failed
            </h2>
            <p className="mt-1 text-sm text-[var(--foreground)]/70">
              {error ?? "An error occurred while processing this document."}
            </p>
            <Link
              href="/dashboard"
              className="mt-5 inline-flex items-center justify-center px-4 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const itemCount = items.length;
  const groupCount = grouped.length;

  return (
    <>
      <div className="space-y-6">
        {/* Breadcrumb + back */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:underline"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Dashboard
        </Link>

        {/* Document header card */}
        <div className="bg-[var(--background-card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent)]">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h1 className="text-lg font-semibold text-[var(--foreground)] truncate">
                  {fileName ?? "Document"}
                </h1>
              </div>
              <p className="mt-1.5 text-sm text-[var(--foreground)]/60">
                {itemCount} item{itemCount !== 1 ? "s" : ""} detected ·{" "}
                {groupCount} HS code group{groupCount !== 1 ? "s" : ""}
              </p>
            </div>
            <a
              href={"/api/documents/" + documentId + "/download"}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm transition-colors shadow-sm shrink-0"
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download Excel
            </a>
          </div>
        </div>

        {/* Grouped by HS code on top, Detected items below */}
        <div className="flex flex-col gap-8">
          {/* Grouped by HS code */}
          <div className="bg-[var(--background-card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--background)]/50 flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-semibold text-[var(--foreground)] text-sm">
                  Grouped by HS code
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={startAddGrouped}
                    disabled={editingGroupId !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add group
                  </button>
                  <span className="text-xs font-medium text-[var(--foreground)]/60 bg-[var(--border)]/80 px-2 py-0.5 rounded">
                    {filteredGrouped.length === grouped.length
                      ? `${groupCount} groups`
                      : `${filteredGrouped.length} of ${groupCount} groups`}
                  </span>
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]/40 pointer-events-none">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
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
                  value={searchGrouped}
                  onChange={(e) => setSearchGrouped(e.target.value)}
                  placeholder="Search HS code, category…"
                  className="w-full pl-9 pr-8 py-2 text-sm border border-[var(--border)] rounded-lg bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
                  aria-label="Search grouped results"
                />
                {searchGrouped && (
                  <button
                    type="button"
                    onClick={() => setSearchGrouped("")}
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
            </div>
            <div className="overflow-auto max-h-[28rem] flex-1">
              <table className="w-full text-sm">
                <thead className="bg-[var(--background)]/80 sticky top-0 z-[1]">
                  <tr>
                    <th className="px-4 py-2.5 text-left w-24">
                      <button
                        type="button"
                        onClick={() => toggleSortGrouped("hsCode")}
                        className="font-medium text-[var(--foreground)]/70 uppercase tracking-wider text-xs flex items-center gap-1 hover:text-[var(--foreground)]"
                      >
                        HS Code
                        {sortGrouped.key === "hsCode" &&
                          (sortGrouped.dir === "asc" ? " ↑" : " ↓")}
                      </button>
                    </th>
                    <th className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSortGrouped("category")}
                        className="font-medium text-[var(--foreground)]/70 uppercase tracking-wider text-xs flex items-center gap-1 hover:text-[var(--foreground)]"
                      >
                        Category
                        {sortGrouped.key === "category" &&
                          (sortGrouped.dir === "asc" ? " ↑" : " ↓")}
                      </button>
                    </th>
                    <th className="px-4 py-2.5 w-20">
                      <button
                        type="button"
                        onClick={() => toggleSortGrouped("qty")}
                        className="font-medium text-[var(--foreground)]/70 uppercase tracking-wider text-xs flex items-center gap-1 hover:text-[var(--foreground)]"
                      >
                        Qty
                        {sortGrouped.key === "qty" &&
                          (sortGrouped.dir === "asc" ? " ↑" : " ↓")}
                      </button>
                    </th>
                    <th className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSortGrouped("description")}
                        className="font-medium text-[var(--foreground)]/70 uppercase tracking-wider text-xs flex items-center gap-1 hover:text-[var(--foreground)]"
                      >
                        Description
                        {sortGrouped.key === "description" &&
                          (sortGrouped.dir === "asc" ? " ↑" : " ↓")}
                      </button>
                    </th>
                    <th className="px-4 py-2.5 w-24 text-right font-medium text-[var(--foreground)]/70 uppercase tracking-wider text-xs">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Add new group row */}
                  {editingGroupId === ADD_GROUP_ID && (
                    <tr className="border-t border-[var(--border-subtle)] bg-[var(--background)]/80">
                      <td className="px-4 py-2 align-top">
                        <input
                          value={editForm.hsCode}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              hsCode: e.target.value,
                            }))
                          }
                          className="w-full min-w-[5rem] px-2 py-1.5 text-sm font-mono border border-[var(--border)] rounded bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
                          placeholder="HS Code"
                        />
                      </td>
                      <td className="px-4 py-2 align-top">
                        <input
                          value={editForm.category}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              category: e.target.value,
                            }))
                          }
                          className="w-full min-w-[6rem] px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
                          placeholder="Category"
                        />
                      </td>
                      <td className="px-4 py-2 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            value={editForm.totalQuantity}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                totalQuantity: Math.max(
                                  0,
                                  parseInt(e.target.value, 10) || 0
                                ),
                              }))
                            }
                            className="w-20 px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
                          />
                          <input
                            value={editForm.unit}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                unit: e.target.value,
                              }))
                            }
                            className="w-14 px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
                            placeholder="Unit"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2 align-top">
                        <textarea
                          value={editForm.finalDescription}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              finalDescription: e.target.value,
                            }))
                          }
                          rows={2}
                          className="w-full min-w-[10rem] px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none resize-y"
                          placeholder="Description"
                        />
                      </td>
                      <td className="px-4 py-2 text-right align-top">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => saveGrouped(ADD_GROUP_ID)}
                            disabled={savingGroupId === ADD_GROUP_ID}
                            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {savingGroupId === ADD_GROUP_ID ? "Saving…" : "Add"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditGrouped}
                            disabled={savingGroupId === ADD_GROUP_ID}
                            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {sortedGrouped.length === 0 &&
                  editingGroupId !== ADD_GROUP_ID ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-[var(--foreground)]/60 text-sm"
                      >
                        {searchGrouped.trim()
                          ? "No groups match your search."
                          : "No groups."}
                      </td>
                    </tr>
                  ) : (
                    sortedGrouped.map((g) => {
                      const isNeedInfo = g.hsCode === NEED_INFO_HS;
                      const isEditing = editingGroupId === g.id;
                      const isSaving = savingGroupId === g.id;
                      return (
                        <tr
                          key={g.id}
                          className={`border-t border-[var(--border-subtle)] hover:bg-[var(--background)]/50 ${
                            isNeedInfo ? "bg-amber-50/80" : ""
                          } ${isEditing ? "bg-[var(--background)]/80" : ""}`}
                        >
                          {isEditing ? (
                            <>
                              <td className="px-4 py-2 align-top">
                                <input
                                  value={editForm.hsCode}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      hsCode: e.target.value,
                                    }))
                                  }
                                  className="w-full min-w-[5rem] px-2 py-1.5 text-sm font-mono border border-[var(--border)] rounded bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
                                  placeholder="HS Code"
                                />
                              </td>
                              <td className="px-4 py-2 align-top">
                                <input
                                  value={editForm.category}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      category: e.target.value,
                                    }))
                                  }
                                  className="w-full min-w-[6rem] px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
                                  placeholder="Category"
                                />
                              </td>
                              <td className="px-4 py-2 align-top whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    value={editForm.totalQuantity}
                                    onChange={(e) =>
                                      setEditForm((f) => ({
                                        ...f,
                                        totalQuantity: Math.max(
                                          0,
                                          parseInt(e.target.value, 10) || 0
                                        ),
                                      }))
                                    }
                                    className="w-20 px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
                                  />
                                  <input
                                    value={editForm.unit}
                                    onChange={(e) =>
                                      setEditForm((f) => ({
                                        ...f,
                                        unit: e.target.value,
                                      }))
                                    }
                                    className="w-14 px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
                                    placeholder="Unit"
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-2 align-top">
                                <textarea
                                  value={editForm.finalDescription}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      finalDescription: e.target.value,
                                    }))
                                  }
                                  rows={2}
                                  className="w-full min-w-[10rem] px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none resize-y"
                                  placeholder="Description"
                                />
                              </td>
                              <td className="px-4 py-2 text-right align-top">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => saveGrouped(g.id)}
                                    disabled={isSaving}
                                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    {isSaving ? "Saving…" : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditGrouped}
                                    disabled={isSaving}
                                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-2.5 font-mono text-[var(--foreground)]">
                                {g.hsCode}
                              </td>
                              <td className="px-4 py-2.5 text-[var(--foreground)]/80 text-xs">
                                {g.category}
                              </td>
                              <td className="px-4 py-2.5 text-[var(--foreground)]/80 whitespace-nowrap">
                                {g.totalQuantity} {g.unit ?? "PCS"}
                              </td>
                              <td className="px-4 py-2.5 text-[var(--foreground)]/80 align-top max-w-[180px] md:max-w-none">
                                <span className="line-clamp-2">
                                  {g.finalDescription}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => startEditGrouped(g)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--foreground)]/80 border border-[var(--border)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                                >
                                  Edit
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detected items */}
          <div className="bg-[var(--background-card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm flex flex-col">
            <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--background)]/60 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--background)] border border-[var(--border)]">
                    <svg
                      className="h-4 w-4 text-[var(--foreground)]/60"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 6h16M4 10h16M4 14h16M4 18h16"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-semibold text-[var(--foreground)]">
                      Detected items
                    </h2>
                    <p className="text-xs text-[var(--foreground)]/60 mt-0.5">
                      {filteredItems.length === items.length
                        ? `${itemCount} line items`
                        : `Showing ${filteredItems.length} of ${itemCount} items`}
                    </p>
                  </div>
                </div>
                <div className="min-w-0 flex-1 sm:max-w-xs">
                  <label htmlFor="detected-items-search" className="sr-only">
                    Search detected items
                  </label>
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]/40"
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
                      id="detected-items-search"
                      type="search"
                      value={searchItems}
                      onChange={(e) => setSearchItems(e.target.value)}
                      placeholder="Search by description, HS code, category…"
                      className="w-full rounded-lg border border-[var(--border)] bg-white py-2 pl-9 pr-8 text-sm outline-none transition-colors placeholder:text-[var(--foreground)]/40 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                      aria-label="Search detected items"
                    />
                    {searchItems && (
                      <button
                        type="button"
                        onClick={() => setSearchItems("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[var(--foreground)]/50 hover:bg-[var(--background)] hover:text-[var(--foreground)]"
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
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="overflow-auto max-h-[28rem] flex-1">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-[1] border-b border-[var(--border)] bg-[var(--background)] shadow-[0_1px_0_0_var(--border)]">
                  <tr>
                    <th scope="col" className="text-left">
                      <button
                        type="button"
                        onClick={() => toggleSortItems("description")}
                        className="flex w-full items-center gap-1.5 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]/80 hover:text-[var(--foreground)]"
                      >
                        Description
                        {sortItems.key === "description" && (
                          <span className="text-[var(--accent)]" aria-hidden>
                            {sortItems.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                    <th scope="col" className="w-20 text-right">
                      <button
                        type="button"
                        onClick={() => toggleSortItems("qty")}
                        className="flex w-full items-center justify-end gap-1.5 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]/80 hover:text-[var(--foreground)]"
                      >
                        Qty
                        {sortItems.key === "qty" && (
                          <span className="text-[var(--accent)]" aria-hidden>
                            {sortItems.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                    <th scope="col" className="w-28">
                      <button
                        type="button"
                        onClick={() => toggleSortItems("hs")}
                        className="flex w-full items-center gap-1.5 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]/80 hover:text-[var(--foreground)]"
                      >
                        HS code
                        {sortItems.key === "hs" && (
                          <span className="text-[var(--accent)]" aria-hidden>
                            {sortItems.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                    <th scope="col" className="min-w-[7rem]">
                      <button
                        type="button"
                        onClick={() => toggleSortItems("category")}
                        className="flex w-full items-center gap-1.5 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]/80 hover:text-[var(--foreground)]"
                      >
                        Category
                        {sortItems.key === "category" && (
                          <span className="text-[var(--accent)]" aria-hidden>
                            {sortItems.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-0">
                        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--background)] border border-[var(--border)]">
                            <svg
                              className="h-6 w-6 text-[var(--foreground)]/40"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </div>
                          <p className="font-medium text-[var(--foreground)]">
                            {searchItems.trim()
                              ? "No matching items"
                              : "No items"}
                          </p>
                          <p className="mt-1 text-sm text-[var(--foreground)]/60 max-w-xs">
                            {searchItems.trim()
                              ? "Try a different search term or clear the search."
                              : "No line items were detected in this document."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedItems.map((i, index) => {
                      const desc =
                        i.cleanDescription ??
                        i.detectedDescription ??
                        i.rawLine ??
                        "—";
                      const isNeedInfo = (i.aiHsCode ?? "") === NEED_INFO_HS;
                      const hsDisplay = i.aiHsCode ?? "—";
                      const catDisplay = i.aiCategory ?? "—";
                      const isExclude =
                        (catDisplay || "").toLowerCase().includes("non-item") ||
                        (catDisplay || "").toLowerCase() === "exclude";
                      return (
                        <tr
                          key={i.id}
                          className={`border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--background)]/60 ${
                            index % 2 === 1 ? "bg-[var(--background)]/30" : ""
                          } ${isNeedInfo ? "bg-amber-50/70" : ""}`}
                        >
                          <td className="px-4 py-3 align-top">
                            <div className="max-w-[200px] md:max-w-none">
                              <p className="leading-snug text-[var(--foreground)] line-clamp-2">
                                {desc || (
                                  <span className="italic text-[var(--foreground)]/50">
                                    No description
                                  </span>
                                )}
                              </p>
                              {isNeedInfo && (
                                <span className="mt-1.5 inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                  Need more description
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-[var(--foreground)]/80">
                            {i.detectedQuantity != null
                              ? i.detectedQuantity.toLocaleString()
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {hsDisplay !== "—" ? (
                              <code className="inline-flex rounded border border-[var(--border)] bg-[var(--background)]/80 px-2 py-1 font-mono text-xs text-[var(--foreground)]">
                                {hsDisplay}
                              </code>
                            ) : (
                              <span className="text-[var(--foreground)]/50">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {catDisplay !== "—" ? (
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  isExclude
                                    ? "bg-[var(--border)]/80 text-[var(--foreground)]/70"
                                    : "bg-[var(--accent-light)]/80 text-[var(--foreground)]"
                                }`}
                              >
                                {catDisplay}
                              </span>
                            ) : (
                              <span className="text-[var(--foreground)]/50">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <DocumentChat documentId={documentId} />
    </>
  );
}
