"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
  PageHeader,
  dashInputClass,
  dashSelectClass,
} from "@/components/dashboard/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { VddColumnMappings, VddFieldKey } from "@/lib/vdd/column-map";
import { VDD_FIELD_KEYS, VDD_FIELD_LABELS } from "@/lib/vdd/column-map";

type PreviewRow = {
  sourceRowNumber: number;
  valid: boolean;
  reasons: string[];
  data: Partial<Record<VddFieldKey, string | null>>;
  extraAttributes?: Record<string, string>;
  dataQualityFlags: string[];
};

type PreviewResponse = {
  ok?: boolean;
  error?: string;
  fileName: string;
  sheetNames: string[];
  sheetName: string;
  headers: string[];
  detectedMappings: VddColumnMappings;
  effectiveMappings: VddColumnMappings;
  totalDataRows: number;
  validRowCount: number;
  invalidRowCount: number;
  qualityFlaggedCount: number;
  extraHeaders?: string[];
  extraColumnCount?: number;
  previewRows: PreviewRow[];
  invalidSample: Array<{ sourceRowNumber: number; reasons: string[] }>;
  disclaimer: string;
};

type BatchRow = {
  id: string;
  sourceFileName: string;
  sheetName: string | null;
  status: string;
  rowCount: number | null;
  validRowCount: number | null;
  invalidRowCount: number | null;
  extraColumns?: unknown;
  createdAt: string;
  completedAt: string | null;
};

type ImportSummary = {
  batchId: string;
  fileName: string;
  sheetName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  qualityFlaggedCount: number;
};

type StoredRecord = {
  id: string;
  importBatchId: string;
  sourceFileName?: string | null;
  sourceRowNumber: number;
  hsCode: string;
  commonName: string | null;
  commercialDescription: string | null;
  brandOrMake: string | null;
  model: string | null;
  originCode: string | null;
  countryName: string | null;
  unitOfQuantity: string | null;
  declaredUnitPrice: string | null;
  currencyCode: string;
  material: string | null;
  appearance: string | null;
  condition: string | null;
  importerName: string | null;
  declarationNumber: string | null;
  extraAttributes?: Record<string, string> | null;
  dataQualityFlags: unknown;
};

type SortField =
  | "hsCode"
  | "brandOrMake"
  | "model"
  | "originCode"
  | "declaredUnitPrice"
  | "sourceRowNumber"
  | "createdAt"
  | "commonName"
  | "sourceFileName";

const PREVIEW_COLS: VddFieldKey[] = [
  "hs_code",
  "common_name",
  "brand_or_make",
  "model",
  "origin_code",
  "declared_unit_price",
  "currency_code",
];

const PAGE_SIZES = [25, 50, 100] as const;

function SortMark({
  active,
  order,
}: {
  active: boolean;
  order: "asc" | "desc";
}) {
  if (!active) return <span className="ml-1 text-slate-300">â†•</span>;
  return (
    <span className="ml-1 text-indigo-600">{order === "asc" ? "â†‘" : "â†“"}</span>
  );
}

function formatExtraAttributes(
  extras: Record<string, string> | null | undefined,
): string {
  if (!extras || Object.keys(extras).length === 0) return "—";
  return Object.entries(extras)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

function extraColumnCount(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.filter((v) => typeof v === "string" && v.trim()).length;
}

function RecordsTableBody({
  loading,
  rows,
  showFileColumn,
  emptyColSpan,
}: {
  loading: boolean;
  rows: StoredRecord[];
  showFileColumn: boolean;
  emptyColSpan: number;
}) {
  if (!loading && rows.length === 0) {
    return (
      <DashTableEmpty colSpan={emptyColSpan}>
        No rows found
      </DashTableEmpty>
    );
  }

  return (
    <>
      {rows.map((row) => {
        const extras = row.extraAttributes ?? {};
        const extraCount = Object.keys(extras).length;
        return (
          <DashTr key={row.id}>
            {showFileColumn && (
              <DashTd>
                <span className="line-clamp-2 max-w-[10rem] text-xs text-slate-600">
                  {row.sourceFileName ?? "—"}
                </span>
              </DashTd>
            )}
            <DashTd>{row.sourceRowNumber}</DashTd>
            <DashTd>
              <span className="font-mono text-sm">{row.hsCode}</span>
            </DashTd>
            <DashTd>
              <span className="line-clamp-2 max-w-[14rem]">
                {row.commonName ?? row.commercialDescription ?? "—"}
              </span>
            </DashTd>
            <DashTd>{row.brandOrMake ?? "—"}</DashTd>
            <DashTd>{row.model ?? "—"}</DashTd>
            <DashTd>{row.originCode ?? row.countryName ?? "—"}</DashTd>
            <DashTd>{row.declaredUnitPrice ?? "—"}</DashTd>
            <DashTd>{row.currencyCode}</DashTd>
            <DashTd>
              {extraCount === 0 ? (
                <span className="text-slate-400">—</span>
              ) : (
                <span
                  className="line-clamp-2 max-w-[16rem] text-xs text-slate-700"
                  title={formatExtraAttributes(extras)}
                >
                  <span className="mr-1 inline-flex rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                    +{extraCount}
                  </span>
                  {formatExtraAttributes(extras)}
                </span>
              )}
            </DashTd>
          </DashTr>
        );
      })}
    </>
  );
}

function TableLoadingState({ label = "Loading rows…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[14rem] flex-col items-center justify-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80"
      role="status"
      aria-live="polite"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#007bff]" />
      <p className="text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

export function VddImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<VddColumnMappings>({});
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Global all-records table
  const [allRows, setAllRows] = useState<StoredRecord[]>([]);
  const [allTotal, setAllTotal] = useState(0);
  const [allPage, setAllPage] = useState(1);
  const [allTotalPages, setAllTotalPages] = useState(1);
  const [allPageSize, setAllPageSize] = useState<number>(25);
  const [allSearch, setAllSearch] = useState("");
  const [debouncedAllSearch, setDebouncedAllSearch] = useState("");
  const [allBatchFilter, setAllBatchFilter] = useState("");
  const [allOriginFilter, setAllOriginFilter] = useState("");
  const [allBrandFilter, setAllBrandFilter] = useState("");
  const [allSortBy, setAllSortBy] = useState<SortField>("createdAt");
  const [allSortOrder, setAllSortOrder] = useState<"asc" | "desc">("desc");
  const [origins, setOrigins] = useState<string[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);

  // Batch modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalBatchId, setModalBatchId] = useState<string | null>(null);
  const [modalBatchLabel, setModalBatchLabel] = useState("");
  const [modalRows, setModalRows] = useState<StoredRecord[]>([]);
  const [modalTotal, setModalTotal] = useState(0);
  const [modalPage, setModalPage] = useState(1);
  const [modalTotalPages, setModalTotalPages] = useState(1);
  const [modalSearch, setModalSearch] = useState("");
  const [debouncedModalSearch, setDebouncedModalSearch] = useState("");
  const [loadingModal, setLoadingModal] = useState(false);

  const loadBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await fetch("/api/dashboard/vdd/batches");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load batches");
      setBatches(data.batches ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load batches");
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedAllSearch(allSearch.trim());
      setAllPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [allSearch]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedModalSearch(modalSearch.trim());
      setModalPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [modalSearch]);

  const loadAllRecords = useCallback(async () => {
    setLoadingAll(true);
    setAllRows([]);
    try {
      const params = new URLSearchParams();
      params.set("page", String(allPage));
      params.set("pageSize", String(allPageSize));
      params.set("sortBy", allSortBy);
      params.set("sortOrder", allSortOrder);
      if (debouncedAllSearch) params.set("q", debouncedAllSearch);
      if (allBatchFilter) params.set("batchId", allBatchFilter);
      if (allOriginFilter) params.set("originCode", allOriginFilter);
      if (allBrandFilter.trim()) params.set("brandOrMake", allBrandFilter.trim());

      const res = await fetch(`/api/dashboard/vdd/records?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load records");
      setAllRows(data.rows ?? []);
      setAllTotal(data.total ?? 0);
      setAllTotalPages(data.totalPages ?? 1);
      setOrigins(data.filterOptions?.origins ?? []);
      if (data.page && data.page !== allPage) setAllPage(data.page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load records");
    } finally {
      setLoadingAll(false);
    }
  }, [
    allPage,
    allPageSize,
    allSortBy,
    allSortOrder,
    debouncedAllSearch,
    allBatchFilter,
    allOriginFilter,
    allBrandFilter,
  ]);

  useEffect(() => {
    void loadAllRecords();
  }, [loadAllRecords]);

  const loadModalRecords = useCallback(async () => {
    if (!modalOpen || !modalBatchId) return;
    setLoadingModal(true);
    try {
      const params = new URLSearchParams();
      params.set("batchId", modalBatchId);
      params.set("page", String(modalPage));
      params.set("pageSize", "25");
      params.set("sortBy", "sourceRowNumber");
      params.set("sortOrder", "asc");
      if (debouncedModalSearch) params.set("q", debouncedModalSearch);
      const res = await fetch(`/api/dashboard/vdd/records?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load batch rows");
      setModalRows(data.rows ?? []);
      setModalTotal(data.total ?? 0);
      setModalTotalPages(data.totalPages ?? 1);
      if (data.page && data.page !== modalPage) setModalPage(data.page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load batch rows");
    } finally {
      setLoadingModal(false);
    }
  }, [modalOpen, modalBatchId, modalPage, debouncedModalSearch]);

  useEffect(() => {
    void loadModalRecords();
  }, [loadModalRecords]);

  const openBatchModal = (batch: BatchRow) => {
    setModalBatchId(batch.id);
    setModalBatchLabel(batch.sourceFileName);
    setModalPage(1);
    setModalSearch("");
    setDebouncedModalSearch("");
    setModalRows([]);
    setModalTotal(0);
    setLoadingModal(true);
    setModalOpen(true);
  };

  const onAllSort = (field: SortField) => {
    if (allSortBy === field) {
      setAllSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setAllSortBy(field);
      setAllSortOrder(field === "createdAt" ? "desc" : "asc");
    }
    setAllPage(1);
  };

  const resetUploadState = () => {
    setFile(null);
    setPreview(null);
    setSummary(null);
    setSheetName("");
    setSheetNames([]);
    setHeaders([]);
    setMappings({});
    setDragActive(false);
  };

  const openUploadModal = () => {
    resetUploadState();
    setUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    if (previewing || importing) return;
    setUploadModalOpen(false);
    resetUploadState();
  };

  const acceptFile = (f: File | undefined) => {
    if (!f) return;
    const name = f.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }
    setFile(f);
    setPreview(null);
    setSummary(null);
    setSheetName("");
    setSheetNames([]);
    setHeaders([]);
    setMappings({});
  };

  const buildFormData = () => {
    if (!file) return null;
    const form = new FormData();
    form.append("file", file);
    if (sheetName) form.append("sheetName", sheetName);
    const cleaned: VddColumnMappings = {};
    for (const key of VDD_FIELD_KEYS) {
      const header = mappings[key];
      if (header) cleaned[key] = header;
    }
    if (Object.keys(cleaned).length > 0) {
      form.append("columnMappings", JSON.stringify(cleaned));
    }
    return form;
  };

  const runPreview = async () => {
    const form = buildFormData();
    if (!form) {
      toast.error("Select an Excel file first");
      return;
    }
    setPreviewing(true);
    try {
      const res = await fetch("/api/dashboard/vdd/preview", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as PreviewResponse;
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data);
      setSheetNames(data.sheetNames);
      setSheetName(data.sheetName);
      setHeaders(data.headers);
      setMappings(data.effectiveMappings);
      toast.success(
        `Preview ready: ${data.validRowCount} valid / ${data.invalidRowCount} invalid`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  };

  const runImport = async () => {
    const form = buildFormData();
    if (!form) {
      toast.error("Select an Excel file first");
      return;
    }
    if (!preview) {
      toast.error("Preview the file before importing");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/dashboard/vdd/import", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        const details =
          data.details && typeof data.details === "object"
            ? Object.entries(data.details as Record<string, string[]>)
                .flatMap(([k, v]) =>
                  (Array.isArray(v) ? v : []).map((msg) => `${k}: ${msg}`),
                )
                .join("; ")
            : "";
        throw new Error(
          details
            ? `${data.error ?? "Import failed"} — ${details}`
            : (data.error ?? "Import failed"),
        );
      }
      setSummary({
        batchId: data.batchId,
        fileName: data.fileName,
        sheetName: data.sheetName,
        totalRows: data.totalRows,
        validRows: data.validRows,
        invalidRows: data.invalidRows,
        qualityFlaggedCount: data.qualityFlaggedCount ?? 0,
      });
      toast.success(`Imported ${data.validRows} VDD rows`);
      await loadBatches();
      setAllPage(1);
      await loadAllRecords();
      setUploadModalOpen(false);
      resetUploadState();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const mappingRows = useMemo(
    () =>
      VDD_FIELD_KEYS.map((key) => ({
        key,
        label: VDD_FIELD_LABELS[key],
        value: mappings[key] ?? "",
      })),
    [mappings],
  );

  const completedBatches = useMemo(
    () => batches.filter((b) => b.status === "completed"),
    [batches],
  );


  return (
    <div className="w-full min-w-0 space-y-6">
      <PageHeader
        title="VDD import"
        description="Import historical Valuation Details Declaration rows from Excel. These records support product review only — they do not determine the final HS code or customs value."
      />

      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
        VDD references support review only. They do not determine the final HS
        code or customs value.
      </div>

      <DashCard>
        <DashCardHeader
          title="All imported VDD rows"
          action={
            <DashButton type="button" onClick={openUploadModal}>
              Import Excel
            </DashButton>
          }
        />
        <div className="space-y-4 p-5 pt-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="block min-w-0 flex-1 text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Search
              </span>
              <input
                className={`${dashInputClass} w-full`}
                placeholder="HS code, brand, model, description, file…"
                value={allSearch}
                onChange={(e) => setAllSearch(e.target.value)}
              />
            </label>
            <label className="block w-full text-sm lg:w-52">
              <span className="mb-1 block font-medium text-slate-700">
                File / batch
              </span>
              <select
                className={`${dashSelectClass} w-full`}
                value={allBatchFilter}
                onChange={(e) => {
                  setAllBatchFilter(e.target.value);
                  setAllPage(1);
                }}
              >
                <option value="">All files</option>
                {completedBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.sourceFileName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block w-full text-sm lg:w-40">
              <span className="mb-1 block font-medium text-slate-700">
                Origin
              </span>
              <select
                className={`${dashSelectClass} w-full`}
                value={allOriginFilter}
                onChange={(e) => {
                  setAllOriginFilter(e.target.value);
                  setAllPage(1);
                }}
              >
                <option value="">All origins</option>
                {origins.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className="block w-full text-sm lg:w-48">
              <span className="mb-1 block font-medium text-slate-700">
                Brand contains
              </span>
              <input
                className={`${dashInputClass} w-full`}
                placeholder="e.g. GONGLANG"
                value={allBrandFilter}
                onChange={(e) => {
                  setAllBrandFilter(e.target.value);
                  setAllPage(1);
                }}
              />
            </label>
          </div>

          <p className="text-sm text-slate-500">
            {loadingAll
              ? "Loading…"
              : `${allTotal.toLocaleString()} rows · click a column header to sort`}
          </p>

          {loadingAll && allRows.length === 0 ? (
            <TableLoadingState label="Loading imported rows…" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <DashTable>
                  <DashTableHead>
                    <DashTableHeaderRow>
                      <DashTh>
                        <button
                          type="button"
                          className="inline-flex items-center font-semibold"
                          onClick={() => onAllSort("sourceFileName")}
                        >
                          File
                          <SortMark
                            active={allSortBy === "sourceFileName"}
                            order={allSortOrder}
                          />
                        </button>
                      </DashTh>
                      <DashTh>
                        <button
                          type="button"
                          className="inline-flex items-center font-semibold"
                          onClick={() => onAllSort("sourceRowNumber")}
                        >
                          Row
                          <SortMark
                            active={allSortBy === "sourceRowNumber"}
                            order={allSortOrder}
                          />
                        </button>
                      </DashTh>
                      <DashTh>
                        <button
                          type="button"
                          className="inline-flex items-center font-semibold"
                          onClick={() => onAllSort("hsCode")}
                        >
                          HS code
                          <SortMark
                            active={allSortBy === "hsCode"}
                            order={allSortOrder}
                          />
                        </button>
                      </DashTh>
                      <DashTh>
                        <button
                          type="button"
                          className="inline-flex items-center font-semibold"
                          onClick={() => onAllSort("commonName")}
                        >
                          Common name
                          <SortMark
                            active={allSortBy === "commonName"}
                            order={allSortOrder}
                          />
                        </button>
                      </DashTh>
                      <DashTh>
                        <button
                          type="button"
                          className="inline-flex items-center font-semibold"
                          onClick={() => onAllSort("brandOrMake")}
                        >
                          Brand
                          <SortMark
                            active={allSortBy === "brandOrMake"}
                            order={allSortOrder}
                          />
                        </button>
                      </DashTh>
                      <DashTh>
                        <button
                          type="button"
                          className="inline-flex items-center font-semibold"
                          onClick={() => onAllSort("model")}
                        >
                          Model
                          <SortMark
                            active={allSortBy === "model"}
                            order={allSortOrder}
                          />
                        </button>
                      </DashTh>
                      <DashTh>
                        <button
                          type="button"
                          className="inline-flex items-center font-semibold"
                          onClick={() => onAllSort("originCode")}
                        >
                          Origin
                          <SortMark
                            active={allSortBy === "originCode"}
                            order={allSortOrder}
                          />
                        </button>
                      </DashTh>
                      <DashTh>
                        <button
                          type="button"
                          className="inline-flex items-center font-semibold"
                          onClick={() => onAllSort("declaredUnitPrice")}
                        >
                          Unit price
                          <SortMark
                            active={allSortBy === "declaredUnitPrice"}
                            order={allSortOrder}
                          />
                        </button>
                      </DashTh>
                      <DashTh>Currency</DashTh>
                      <DashTh>Extra</DashTh>
                    </DashTableHeaderRow>
                  </DashTableHead>
                  <DashTbody>
                    <RecordsTableBody
                      loading={loadingAll}
                      rows={allRows}
                      showFileColumn
                      emptyColSpan={10}
                    />
                  </DashTbody>
                </DashTable>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  Page {allPage} of {allTotalPages}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="whitespace-nowrap">Rows per page</span>
                    <select
                      className={`${dashSelectClass} w-20`}
                      value={allPageSize}
                      onChange={(e) => {
                        setAllPageSize(Number(e.target.value));
                        setAllPage(1);
                      }}
                    >
                      {PAGE_SIZES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <DashButton
                    type="button"
                    variant="secondary"
                    disabled={allPage <= 1 || loadingAll}
                    onClick={() => setAllPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </DashButton>
                  <DashButton
                    type="button"
                    variant="secondary"
                    disabled={allPage >= allTotalPages || loadingAll}
                    onClick={() =>
                      setAllPage((p) => Math.min(allTotalPages, p + 1))
                    }
                  >
                    Next
                  </DashButton>
                </div>
              </div>
            </>
          )}
        </div>
      </DashCard>

      <DashCard>
        <DashCardHeader title="Import batches" />
        <div className="overflow-x-auto p-5 pt-0">
          <p className="mb-3 text-sm text-slate-500">
            Click <strong>View</strong> to open that file&apos;s rows in a popup.
          </p>
          {loadingBatches ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <DashTable>
              <DashTableHead>
                <DashTableHeaderRow>
                  <DashTh>File</DashTh>
                  <DashTh>Status</DashTh>
                  <DashTh>Valid</DashTh>
                  <DashTh>Invalid</DashTh>
                  <DashTh>Created</DashTh>
                  <DashTh align="right">Action</DashTh>
                </DashTableHeaderRow>
              </DashTableHead>
              <DashTbody>
                {batches.length === 0 ? (
                  <DashTableEmpty colSpan={6}>No batches yet</DashTableEmpty>
                ) : (
                  batches.map((b) => (
                    <DashTr key={b.id}>
                      <DashTd>
                        <div className="font-medium text-slate-900">
                          {b.sourceFileName}
                        </div>
                        {extraColumnCount(b.extraColumns) > 0 && (
                          <span className="mt-1 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                            +{extraColumnCount(b.extraColumns)} extra cols
                          </span>
                        )}
                      </DashTd>
                      <DashTd>{b.status}</DashTd>
                      <DashTd>{b.validRowCount ?? "—"}</DashTd>
                      <DashTd>{b.invalidRowCount ?? "—"}</DashTd>
                      <DashTd>
                        {new Date(b.createdAt).toLocaleString()}
                      </DashTd>
                      <DashTd align="right">
                        <DashButton
                          type="button"
                          variant="ghost"
                          disabled={b.status !== "completed"}
                          onClick={() => openBatchModal(b)}
                        >
                          View
                        </DashButton>
                      </DashTd>
                    </DashTr>
                  ))
                )}
              </DashTbody>
            </DashTable>
          )}
        </div>
      </DashCard>

      <Dialog
        open={uploadModalOpen}
        onOpenChange={(open) => {
          if (!open) closeUploadModal();
          else setUploadModalOpen(true);
        }}
      >
        <DialogContent
          className="max-h-[90vh] w-[min(96vw,56rem)] max-w-4xl overflow-y-auto"
          showClose={!previewing && !importing}
        >
          <DialogHeader>
            <DialogTitle>Upload Excel</DialogTitle>
            <DialogDescription>
              Preview column mappings, then import valid VDD rows. Historical
              references only — not a final customs decision.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div
              className={`rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
                dragActive
                  ? "border-indigo-400 bg-indigo-50/50"
                  : "border-slate-200 bg-slate-50/50"
              }`}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                acceptFile(e.dataTransfer.files?.[0]);
              }}
            >
              <p className="text-sm font-medium text-slate-800">
                {file ? file.name : "Drop .xlsx here or choose a file"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                File is parsed in memory; only cleaned rows are stored.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <label className="inline-flex cursor-pointer">
                  <span className="sr-only">Choose file</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    className="block w-full max-w-xs text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                    onChange={(e) =>
                      acceptFile(e.target.files?.[0] ?? undefined)
                    }
                  />
                </label>
              </div>
            </div>

            {sheetNames.length > 0 && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Sheet
                </span>
                <select
                  className={dashSelectClass}
                  value={sheetName}
                  onChange={(e) => {
                    setSheetName(e.target.value);
                    setPreview(null);
                    setSummary(null);
                  }}
                >
                  {sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex flex-wrap gap-3">
              <DashButton
                type="button"
                onClick={() => void runPreview()}
                disabled={!file || previewing}
              >
                {previewing ? "Previewing…" : "Preview mapping"}
              </DashButton>
              <DashButton
                type="button"
                variant="secondary"
                onClick={() => void runImport()}
                disabled={
                  !file ||
                  !preview ||
                  importing ||
                  preview.validRowCount === 0
                }
              >
                {importing ? "Importing…" : "Import valid rows"}
              </DashButton>
            </div>

            {preview && (
              <>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">
                    Column mappings
                  </h3>
                  <p className="mb-3 text-sm text-slate-500">
                    Match Excel column titles to app fields if a guess looks
                    wrong, then preview again.
                  </p>
                  <div className="grid max-h-56 gap-3 overflow-y-auto sm:grid-cols-2">
                    {mappingRows.map(({ key, label, value }) => (
                      <label key={key} className="block text-sm">
                        <span className="mb-1 block font-medium text-slate-700">
                          {label}
                          {key === "hs_code" ? " *" : ""}
                        </span>
                        <select
                          className={dashSelectClass}
                          value={value}
                          onChange={(e) => {
                            const next = e.target.value;
                            setMappings((prev) => {
                              const copy = { ...prev };
                              if (!next) delete copy[key];
                              else copy[key] = next;
                              return copy;
                            });
                            setPreview(null);
                            setSummary(null);
                          }}
                        >
                          <option value="">— Not mapped —</option>
                          {headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    Detected {Object.keys(preview.detectedMappings).length}{" "}
                    columns · {preview.validRowCount} valid ·{" "}
                    {preview.invalidRowCount} invalid
                  </p>
                  {(preview.extraHeaders?.length ?? 0) > 0 && (
                    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2 text-sm text-indigo-950">
                      <p className="font-semibold">
                        {preview.extraHeaders!.length} new column
                        {preview.extraHeaders!.length === 1 ? "" : "s"} will be
                        stored as extra fields
                      </p>
                      <p className="mt-1 text-xs text-indigo-800/90">
                        {preview.extraHeaders!.join(" · ")}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">
                    Preview (first 20 rows)
                  </h3>
                  <div className="overflow-x-auto">
                    <DashTable>
                      <DashTableHead>
                        <DashTableHeaderRow>
                          <DashTh>Row</DashTh>
                          <DashTh>Status</DashTh>
                          {PREVIEW_COLS.map((c) => (
                            <DashTh key={c}>{VDD_FIELD_LABELS[c]}</DashTh>
                          ))}
                        </DashTableHeaderRow>
                      </DashTableHead>
                      <DashTbody>
                        {preview.previewRows.length === 0 ? (
                          <DashTableEmpty colSpan={2 + PREVIEW_COLS.length}>
                            No data rows found
                          </DashTableEmpty>
                        ) : (
                          preview.previewRows.map((row) => (
                            <DashTr key={row.sourceRowNumber}>
                              <DashTd>{row.sourceRowNumber}</DashTd>
                              <DashTd>
                                {row.valid ? (
                                  <span className="text-emerald-700">
                                    Valid
                                  </span>
                                ) : (
                                  <span className="text-rose-700">
                                    {row.reasons.join("; ")}
                                  </span>
                                )}
                              </DashTd>
                              {PREVIEW_COLS.map((c) => (
                                <DashTd key={c}>
                                  <span className="line-clamp-2 max-w-[10rem]">
                                    {row.data[c] ?? "—"}
                                  </span>
                                </DashTd>
                              ))}
                            </DashTr>
                          ))
                        )}
                      </DashTbody>
                    </DashTable>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setModalBatchId(null);
            setModalRows([]);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-[min(96vw,90rem)] max-w-[90rem] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modalBatchLabel || "Batch rows"}</DialogTitle>
            <DialogDescription>
              Rows from this Excel import only. Search and page through them
              here. VDD data supports review only.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block min-w-[16rem] flex-1 text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Search in this file
                </span>
                <input
                  className={dashInputClass}
                  placeholder="HS code, brand, model…"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  disabled={loadingModal && modalRows.length === 0}
                />
              </label>
              <p className="pb-2 text-sm text-slate-500">
                {loadingModal
                  ? "Loading…"
                  : `${modalTotal.toLocaleString()} rows`}
              </p>
            </div>

            {loadingModal && modalRows.length === 0 ? (
              <TableLoadingState label="Loading imported rows…" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <DashTable>
                    <DashTableHead>
                      <DashTableHeaderRow>
                        <DashTh>Row</DashTh>
                        <DashTh>HS code</DashTh>
                        <DashTh>Common name</DashTh>
                        <DashTh>Brand</DashTh>
                        <DashTh>Model</DashTh>
                        <DashTh>Origin</DashTh>
                        <DashTh>Unit price</DashTh>
                        <DashTh>Currency</DashTh>
                        <DashTh>Extra</DashTh>
                      </DashTableHeaderRow>
                    </DashTableHead>
                    <DashTbody>
                      <RecordsTableBody
                        loading={loadingModal}
                        rows={modalRows}
                        showFileColumn={false}
                        emptyColSpan={9}
                      />
                    </DashTbody>
                  </DashTable>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    Page {modalPage} of {modalTotalPages}
                  </p>
                  <div className="flex gap-2">
                    <DashButton
                      type="button"
                      variant="secondary"
                      disabled={modalPage <= 1 || loadingModal}
                      onClick={() => setModalPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </DashButton>
                    <DashButton
                      type="button"
                      variant="secondary"
                      disabled={modalPage >= modalTotalPages || loadingModal}
                      onClick={() =>
                        setModalPage((p) => Math.min(modalTotalPages, p + 1))
                      }
                    >
                      Next
                    </DashButton>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
