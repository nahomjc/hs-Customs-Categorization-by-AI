"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  runClassificationBatch,
  startProcessingDocument,
} from "@/app/actions";
import { NEED_INFO_HS } from "@/lib/allowedHsCodes";
import { parseDocumentClassificationMeta } from "@/lib/documentClassificationMeta";
import { DocumentHeroHeader } from "@/components/dashboard/document/DocumentHeroHeader";
import { HsCodeBadge } from "@/components/dashboard/document/HsCodeBadge";
import { DashLink, dashInputClass } from "@/components/dashboard/ui";
import { DocumentChat } from "./DocumentChat";
import { DocumentProcessingStepper } from "./DocumentProcessingStepper";

type Item = {
  id: string;
  rawLine: string | null;
  detectedDescription: string | null;
  detectedQuantity: number | null;
  detectedUnit: string | null;
  sourceHsCode: string | null;
  lineNumber: number | null;
  aiCategory: string | null;
  aiHsCode: string | null;
  cleanDescription: string | null;
  aiRawResponse: string | null;
};

type Grouped = {
  id: string;
  hsCode: string;
  category: string;
  finalDescription: string;
  totalQuantity: number;
  unit: string | null;
};

function itemDesc(i: Item) {
  return i.cleanDescription ?? i.detectedDescription ?? i.rawLine ?? "";
}

export function DocumentView(props: {
  documentId: string;
  status: string | null;
  fileName: string | null;
  classificationMode: string | null;
  defaultExportFormat?: "xlsx" | "csv";
  items: Item[];
  grouped: Grouped[];
}) {
  const router = useRouter();
  const {
    documentId,
    fileName,
    classificationMode,
    defaultExportFormat = "xlsx",
    items,
    grouped,
  } = props;
  const exportLabel =
    defaultExportFormat === "csv" ? "Download CSV" : "Download Excel";
  const isPreCoded = classificationMode === "pre_coded";
  const hasDocumentHs = items.some((i) => i.sourceHsCode);
  const [status, setStatus] = useState(props.status ?? "uploaded");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    totalItems: number;
    classifiedCount: number;
  } | null>(null);
  const [classifyTrigger, setClassifyTrigger] = useState(0);
  const classifyingRef = useRef(false);
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
  const [activeTab, setActiveTab] = useState<"groups" | "items">("groups");

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
              },
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

  const runAllClassificationBatches = useCallback(async () => {
    if (classifyingRef.current) return;
    classifyingRef.current = true;
    setProcessing(true);
    setError(null);
    try {
      for (;;) {
        const r = await runClassificationBatch(documentId);
        if (r.error) {
          setError(r.error);
          setStatus("failed");
          return;
        }
        if (r.totalItems != null && r.classifiedCount != null) {
          setProgress({
            totalItems: r.totalItems,
            classifiedCount: r.classifiedCount,
          });
          setStatus("ai_processed");
        }
        if (r.completed) {
          setStatus("completed");
          router.refresh();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setStatus("failed");
    } finally {
      classifyingRef.current = false;
      setProcessing(false);
    }
  }, [documentId, router]);

  const retryProcessing = async () => {
    setError(null);
    if (status === "failed") {
      setStatus("uploaded");
      setClassifyTrigger((t) => t + 1);
      return;
    }
    setClassifyTrigger((t) => t + 1);
  };

  useEffect(() => {
    if (status !== "uploaded") return;
    let cancelled = false;
    const run = async () => {
      setProcessing(true);
      setError(null);
      try {
        const r = await startProcessingDocument(documentId);
        if (cancelled) return;
        if (r.error) {
          setError(r.error);
          setStatus("failed");
          return;
        }
        if (r.success) {
          setStatus("parsed");
          setClassifyTrigger((t) => t + 1);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed");
          setStatus("failed");
        }
      } finally {
        if (!cancelled) setProcessing(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [documentId, status]);

  useEffect(() => {
    if (status !== "parsed" && status !== "ai_processed") return;
    // Run on resume (ai_processed) or after parse sets classifyTrigger
    if (classifyTrigger === 0 && status !== "ai_processed") return;
    void runAllClassificationBatches();
  }, [classifyTrigger, status, runAllClassificationBatches]);

  useEffect(() => {
    if (status === "completed" || status === "failed" || processing) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/documents/${documentId}/status`);
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
    return (
      <div className="w-full min-w-0 space-y-5">
        <DashLink href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900">
          <svg
            aria-hidden="true"
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
        </DashLink>
        <DocumentProcessingStepper
          fileName={fileName}
          status={status}
          progress={progress}
          isPreCoded={isPreCoded}
          processing={processing}
          onContinueClassification={() => setClassifyTrigger((t) => t + 1)}
        />
      </div>
    );
  }

  if (error || status === "failed") {
    return (
      <div className="w-full min-w-0 space-y-5">
        <DashLink href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900">
          <svg
            aria-hidden="true"
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
        </DashLink>
        <div className="overflow-hidden rounded-3xl border border-red-100 bg-white shadow-[0_8px_40px_-12px_rgba(15,23,42,0.1)]">
          <div className="relative px-6 py-10 text-center sm:px-10">
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-red-50/80 via-white to-orange-50/40"
              aria-hidden
            />
            <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/20">
              <svg
                aria-hidden="true"
                className="h-8 w-8 text-white"
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
            <h2 className="relative text-xl font-bold text-slate-900">
              Processing failed
            </h2>
            <p className="relative mt-2 text-sm text-slate-600 max-w-md mx-auto">
              {error ?? "An error occurred while processing this document."}
            </p>
            <div className="relative mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={retryProcessing}
                disabled={processing}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all disabled:opacity-50"
              >
                {processing ? "Retrying…" : "Try again"}
              </button>
              <Link
                href="/dashboard/upload"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Upload new file
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const itemCount = items.length;
  const groupCount = grouped.length;
  const reviewCount = items.filter((i) => {
    const meta = parseDocumentClassificationMeta(i.aiRawResponse);
    return meta?.reviewRecommended;
  }).length;

  return (
    <>
      <div className="w-full min-w-0 space-y-5 pb-8">
        <DocumentHeroHeader
          fileName={fileName}
          itemCount={itemCount}
          groupCount={groupCount}
          reviewCount={reviewCount}
          exportLabel={exportLabel}
          downloadHref={`/api/documents/${documentId}/download?format=${defaultExportFormat}`}
          isPreCoded={isPreCoded}
        />

        {isPreCoded && (
          <div className="flex items-start gap-3 rounded-2xl border border-sky-200/70 bg-gradient-to-r from-sky-50 to-indigo-50/40 px-4 py-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
              <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-sky-950 leading-relaxed">
              <span className="font-semibold">Pre-coded packing list.</span> HS codes from your document were used for grouping.
              {reviewCount > 0 && (
                <span className="font-medium text-amber-800">
                  {" "}
                  {reviewCount} line{reviewCount === 1 ? "" : "s"} flagged for review.
                </span>
              )}
            </p>
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)]">
          {/* Tab navigation */}
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex rounded-2xl bg-slate-100/80 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("groups")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                  activeTab === "groups"
                    ? "bg-white text-slate-900 shadow-sm shadow-slate-200/80"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                HS Groups
                <span className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
                  activeTab === "groups" ? "bg-indigo-100 text-indigo-700" : "bg-slate-200/80 text-slate-600"
                }`}>
                  {groupCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("items")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                  activeTab === "items"
                    ? "bg-white text-slate-900 shadow-sm shadow-slate-200/80"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Line Items
                <span className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
                  activeTab === "items" ? "bg-violet-100 text-violet-700" : "bg-slate-200/80 text-slate-600"
                }`}>
                  {itemCount}
                </span>
              </button>
            </div>

            {activeTab === "groups" ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={startAddGrouped}
                  disabled={editingGroupId !== null}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                >
                  <svg aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add group
                </button>
                <div className="relative w-full sm:w-64">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="search"
                    value={searchGrouped}
                    onChange={(e) => setSearchGrouped(e.target.value)}
                    placeholder="Search groups…"
                    className={`${dashInputClass} pr-8 border-slate-200/80 bg-slate-50/50 focus:bg-white`}
                    aria-label="Search grouped results"
                  />
                </div>
              </div>
            ) : (
              <div className="relative w-full sm:w-72">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  id="detected-items-search"
                  type="search"
                  value={searchItems}
                  onChange={(e) => setSearchItems(e.target.value)}
                  placeholder="Search line items…"
                  className={`${dashInputClass} pr-8 border-slate-200/80 bg-slate-50/50 focus:bg-white`}
                  aria-label="Search detected items"
                />
              </div>
            )}
          </div>

          {activeTab === "groups" ? (
          <section>
            <div className="overflow-auto max-h-[min(32rem,58vh)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-[1] border-b border-slate-100 bg-slate-50/90 backdrop-blur-sm">
                  <tr>
                    <th className="px-3 py-2 text-left w-24 sm:px-4">
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
                                  Number.parseInt(e.target.value, 10) || 0,
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
                                          Number.parseInt(e.target.value, 10) ||
                                            0,
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
                              <td className="px-4 py-3">
                                <HsCodeBadge code={g.hsCode} />
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                  {g.category}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-700 whitespace-nowrap tabular-nums">
                                <span className="font-semibold text-slate-900">{g.totalQuantity}</span>
                                <span className="ml-1 text-slate-500">{g.unit ?? "PCS"}</span>
                              </td>
                              <td className="px-4 py-3 text-slate-600 align-top max-w-[180px] md:max-w-none">
                                <span className="line-clamp-2 leading-relaxed">
                                  {g.finalDescription}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => startEditGrouped(g)}
                                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
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
          </section>
          ) : (
          <section>
            <div className="overflow-auto max-h-[min(32rem,58vh)]">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-[1] border-b border-slate-100 bg-slate-50/90 backdrop-blur-sm">
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
                    {hasDocumentHs && (
                      <th scope="col" className="w-28">
                        <span className="flex px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]/80">
                          Doc HS
                        </span>
                      </th>
                    )}
                    <th scope="col" className="w-28">
                      <button
                        type="button"
                        onClick={() => toggleSortItems("hs")}
                        className="flex w-full items-center gap-1.5 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]/80 hover:text-[var(--foreground)]"
                      >
                        {hasDocumentHs ? "Classified HS" : "HS code"}
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
                      <td colSpan={hasDocumentHs ? 5 : 4} className="p-0">
                        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--background)] border border-[var(--border)]">
                            <svg
                              aria-hidden="true"
                              className="h-6 w-6 text-[var(--foreground)]/40"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
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
                      const meta = parseDocumentClassificationMeta(
                        i.aiRawResponse
                      );
                      const needsReview = meta?.reviewRecommended === true;
                      const hsDisplay = i.aiHsCode ?? "—";
                      const docHs = i.sourceHsCode ?? "—";
                      const catDisplay = i.aiCategory ?? "—";
                      const isExclude =
                        (catDisplay || "").toLowerCase().includes("non-item") ||
                        (catDisplay || "").toLowerCase() === "exclude";
                      return (
                        <tr
                          key={i.id}
                          className={`border-b border-slate-100 transition-colors hover:bg-indigo-50/20 ${
                            index % 2 === 1 ? "bg-slate-50/40" : ""
                          } ${isNeedInfo ? "bg-amber-50/50" : ""}`}
                        >
                          <td className="px-4 py-3.5 align-top">
                            <div className="max-w-[200px] md:max-w-none">
                              <p className="leading-snug text-slate-800 line-clamp-2 font-medium">
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
                              {needsReview && (
                                <span className="mt-1.5 inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                  Review HS
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-[var(--foreground)]/80">
                            {i.detectedQuantity != null
                              ? i.detectedQuantity.toLocaleString()
                              : "—"}
                            {i.detectedUnit && (
                              <span className="block text-[10px] text-[var(--foreground)]/50">
                                {i.detectedUnit}
                              </span>
                            )}
                          </td>
                          {hasDocumentHs && (
                            <td className="px-4 py-3">
                              {docHs !== "—" ? (
                                <HsCodeBadge code={docHs} variant="document" />
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            {hsDisplay !== "—" ? (
                              <HsCodeBadge code={hsDisplay} />
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {catDisplay !== "—" ? (
                              <span
                                className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${
                                  isExclude
                                    ? "bg-slate-100 text-slate-600"
                                    : "bg-indigo-50 text-indigo-800"
                                }`}
                              >
                                {catDisplay}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
          )}
        </div>
      </div>
      <DocumentChat documentId={documentId} />
    </>
  );
}
