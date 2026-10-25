"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DashButton,
  DashCard,
  DashLink,
  DashTable,
  DashTableEmpty,
  DashTableHead,
  DashTableHeaderRow,
  DashTableToolbar,
  DashTbody,
  DashTd,
  DashTh,
  DashTr,
  StatusBadge,
  DashSelect,
  dashInputClass,
} from "@/components/dashboard/ui";
import {
  IMPORT_CASE_STATUSES,
  IMPORT_CASE_STATUS_LABELS,
  type ImportCaseStatus,
} from "@/lib/import-cases/constants";

type SortBy =
  | "updatedAt"
  | "createdAt"
  | "caseNumber"
  | "importerName"
  | "supplierName"
  | "status";
type SortDir = "asc" | "desc";

const SORT_PRESETS: Array<{ value: string; sortBy: SortBy; sortDir: SortDir; label: string }> = [
  { value: "updatedAt:desc", sortBy: "updatedAt", sortDir: "desc", label: "Updated (newest)" },
  { value: "updatedAt:asc", sortBy: "updatedAt", sortDir: "asc", label: "Updated (oldest)" },
  { value: "createdAt:desc", sortBy: "createdAt", sortDir: "desc", label: "Created (newest)" },
  { value: "createdAt:asc", sortBy: "createdAt", sortDir: "asc", label: "Created (oldest)" },
  { value: "caseNumber:asc", sortBy: "caseNumber", sortDir: "asc", label: "Case # A–Z" },
  { value: "caseNumber:desc", sortBy: "caseNumber", sortDir: "desc", label: "Case # Z–A" },
  { value: "importerName:asc", sortBy: "importerName", sortDir: "asc", label: "Importer A–Z" },
  { value: "importerName:desc", sortBy: "importerName", sortDir: "desc", label: "Importer Z–A" },
  { value: "supplierName:asc", sortBy: "supplierName", sortDir: "asc", label: "Supplier A–Z" },
  { value: "supplierName:desc", sortBy: "supplierName", sortDir: "desc", label: "Supplier Z–A" },
  { value: "status:asc", sortBy: "status", sortDir: "asc", label: "Status A–Z" },
];

export type ImportCaseListItem = {
  id: string;
  caseNumber: string;
  status: string | null;
  importerName: string | null;
  supplierName: string | null;
  shipmentReference: string | null;
  assignedAgentName: string | null;
  assignedAgentEmail: string | null;
  openCheckCount: number;
  updatedAt: Date | string | null;
};

type ImportCasesTableProps = {
  initialItems: ImportCaseListItem[];
  initialTotal: number;
};

export function ImportCasesTable({
  initialItems,
  initialTotal,
}: ImportCasesTableProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ImportCaseStatus | "">("");
  const [sort, setSort] = useState("updatedAt:desc");
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const skipNextFetch = useRef(true);

  const applyFilters = useCallback(
    async (
      nextSearch: string,
      nextStatus: ImportCaseStatus | "",
      nextSort: string,
    ) => {
      setLoading(true);
      try {
        const preset =
          SORT_PRESETS.find((p) => p.value === nextSort) ?? SORT_PRESETS[0];
        const params = new URLSearchParams();
        if (nextSearch.trim()) params.set("search", nextSearch.trim());
        if (nextStatus) params.set("status", nextStatus);
        params.set("sortBy", preset.sortBy);
        params.set("sortDir", preset.sortDir);
        const res = await fetch(`/api/import-cases?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load cases");
        const data = (await res.json()) as {
          items: ImportCaseListItem[];
          total: number;
        };
        setItems(data.items);
        setTotal(data.total);
      } catch {
        // keep current list
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void applyFilters(search, status, sort);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, status, sort, applyFilters]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (status && (item.status ?? "draft") !== status) return false;
      if (!q) return true;
      return (
        item.caseNumber.toLowerCase().includes(q) ||
        (item.importerName ?? "").toLowerCase().includes(q) ||
        (item.supplierName ?? "").toLowerCase().includes(q) ||
        (item.shipmentReference ?? "").toLowerCase().includes(q) ||
        (item.assignedAgentName ?? "").toLowerCase().includes(q) ||
        (item.assignedAgentEmail ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, status]);

  return (
    <DashCard>
      <DashTableToolbar>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <input
            type="search"
            placeholder="Search case number, importer, supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void applyFilters(search, status, sort);
              }
            }}
            className={dashInputClass}
            aria-label="Search import cases"
          />
          <DashSelect
            value={status}
            onChange={(v) => setStatus(v as ImportCaseStatus | "")}
            aria-label="Filter by status"
            options={[
              { value: "", label: "All statuses" },
              ...IMPORT_CASE_STATUSES.map((s) => ({
                value: s,
                label: IMPORT_CASE_STATUS_LABELS[s],
              })),
            ]}
          />
          <DashSelect
            value={sort}
            onChange={setSort}
            aria-label="Sort import cases"
            options={SORT_PRESETS.map((p) => ({
              value: p.value,
              label: p.label,
            }))}
          />
          <DashButton
            onClick={() => void applyFilters(search, status, sort)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Filter"}
          </DashButton>
        </div>
        <p className="text-xs text-gray-500">
          {loading
            ? "Searching…"
            : `${total} import case(s)`}
        </p>
      </DashTableToolbar>

      <DashTable>
        <DashTableHead>
          <DashTableHeaderRow>
            <DashTh>Case #</DashTh>
            <DashTh>Importer</DashTh>
            <DashTh>Supplier</DashTh>
            <DashTh>Status</DashTh>
            <DashTh>Agent</DashTh>
            <DashTh>Checks</DashTh>
            <DashTh>Updated</DashTh>
          </DashTableHeaderRow>
        </DashTableHead>
        <DashTbody>
          {filtered.length === 0 ? (
            <DashTableEmpty colSpan={7}>
              No import cases found. Create your first case to get started.
            </DashTableEmpty>
          ) : (
            filtered.map((item) => (
              <DashTr key={item.id}>
                <DashTd className="text-gray-900">
                  <DashLink href={`/dashboard/import-cases/${item.id}`}>
                    {item.caseNumber}
                  </DashLink>
                </DashTd>
                <DashTd>{item.importerName ?? "—"}</DashTd>
                <DashTd>{item.supplierName ?? "—"}</DashTd>
                <DashTd>
                  <StatusBadge
                    label={
                      IMPORT_CASE_STATUS_LABELS[
                        (item.status as ImportCaseStatus) ?? "draft"
                      ] ??
                      item.status ??
                      "Draft"
                    }
                    status={item.status ?? "draft"}
                  />
                </DashTd>
                <DashTd muted>
                  {item.assignedAgentName ??
                    item.assignedAgentEmail ??
                    "—"}
                </DashTd>
                <DashTd muted>{item.openCheckCount}</DashTd>
                <DashTd muted className="text-xs">
                  {item.updatedAt
                    ? new Date(item.updatedAt).toLocaleString()
                    : "—"}
                </DashTd>
              </DashTr>
            ))
          )}
        </DashTbody>
      </DashTable>
    </DashCard>
  );
}
