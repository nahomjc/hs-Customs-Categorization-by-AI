"use client";

import { useMemo, useState } from "react";
import {
  DashButton,
  DashCard,
  DashLink,
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
      <div className="border-b border-slate-100 px-5 py-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
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
        <p className="text-xs text-slate-500">{total} import case(s)</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3 font-semibold">Case #</th>
              <th className="px-5 py-3 font-semibold">Importer</th>
              <th className="px-5 py-3 font-semibold">Supplier</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Agent</th>
              <th className="px-5 py-3 font-semibold">Checks</th>
              <th className="px-5 py-3 font-semibold">Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                  No import cases found. Create your first case to get started.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-50 hover:bg-slate-50/50"
                >
                  <td className="px-5 py-3">
                    <DashLink href={`/dashboard/import-cases/${item.id}`}>
                      {item.caseNumber}
                    </DashLink>
                  </td>
                  <td className="px-5 py-3 text-slate-700">
                    {item.importerName ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-700">
                    {item.supplierName ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge
                      label={
                        IMPORT_CASE_STATUS_LABELS[
                          (item.status as ImportCaseStatus) ?? "draft"
                        ] ?? item.status ?? "Draft"
                      }
                      status={item.status ?? "draft"}
                    />
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {item.assignedAgentName ??
                      item.assignedAgentEmail ??
                      "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {item.openCheckCount}
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs">
                    {item.updatedAt
                      ? new Date(item.updatedAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashCard>
  );
}
