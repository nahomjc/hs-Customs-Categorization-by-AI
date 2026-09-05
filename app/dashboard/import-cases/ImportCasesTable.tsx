"use client";

import { useMemo, useState } from "react";
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
  dashInputClass,
  dashSelectClass,
} from "@/components/dashboard/ui";
import {
  IMPORT_CASE_STATUSES,
  IMPORT_CASE_STATUS_LABELS,
  type ImportCaseStatus,
} from "@/lib/import-cases/constants";

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
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    if (!search && !status) return items;
    return items;
  }, [items, search, status]);

  async function applyFilters() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
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
  }

  return (
    <DashCard>
      <DashTableToolbar>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            placeholder="Search case number, importer, supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={dashInputClass}
          />
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as ImportCaseStatus | "")
            }
            className={dashSelectClass}
          >
            <option value="">All statuses</option>
            {IMPORT_CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {IMPORT_CASE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <DashButton onClick={applyFilters} disabled={loading}>
            {loading ? "Loading..." : "Filter"}
          </DashButton>
        </div>
        <p className="text-xs text-gray-500">{total} import case(s)</p>
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
