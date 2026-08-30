"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { HsCodeBadge } from "@/components/dashboard/document/HsCodeBadge";
import {
  DashButton,
  DashCard,
  DashCardHeader,
  StatusBadge,
  TruncatedText,
} from "@/components/dashboard/ui";
import { getCountryLabel } from "@/lib/countries";
import {
  GROUPING_STATUS_LABELS,
  type GroupingStatus,
} from "@/lib/import-cases/constants";
import { formatDutyRateFromSnapshot } from "@/lib/import-cases/duty-rate-display";
import type { GroupingWithProducts } from "@/lib/import-cases/grouping-queries";

type GroupingExportTabProps = {
  caseId: string;
  caseNumber: string;
  initialGroupings: GroupingWithProducts[];
};

export function GroupingExportTab({
  caseId,
  caseNumber,
  initialGroupings,
}: GroupingExportTabProps) {
  const router = useRouter();
  const [groupings, setGroupings] =
    useState<GroupingWithProducts[]>(initialGroupings);
  const [grouping, setGrouping] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const totalProducts = useMemo(
    () => groupings.reduce((sum, g) => sum + g.products.length, 0),
    [groupings],
  );
  const totalQuantity = useMemo(
    () => groupings.reduce((sum, g) => sum + g.totalQuantity, 0),
    [groupings],
  );

  async function refresh() {
    const res = await fetch(`/api/import-cases/${caseId}/groupings`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      groupings: GroupingWithProducts[];
    };
    setGroupings(data.groupings);
    router.refresh();
  }

  async function handleGroup() {
    setGrouping(true);
    try {
      const res = await fetch(`/api/import-cases/${caseId}/group`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        error?: string;
        groupCount?: number;
        productCount?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "Grouping failed");
      toast.success(
        `Created ${data.groupCount} declaration group(s) from ${data.productCount} product(s)`,
      );
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Grouping failed");
    } finally {
      setGrouping(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/import-cases/${caseId}/export`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${caseNumber}-declaration.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Declaration CSV downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <DashCard>
      <DashCardHeader
        title="Declaration grouping & export"
        action={
          <div className="flex flex-wrap gap-2">
            <DashButton
              variant="primary"
              onClick={handleGroup}
              disabled={grouping}
            >
              {grouping
                ? "Grouping…"
                : groupings.length > 0
                  ? "Re-group"
                  : "Run grouping"}
            </DashButton>
            {groupings.length > 0 ? (
              <DashButton
                variant="secondary"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? "Exporting…" : "Download CSV"}
              </DashButton>
            ) : null}
          </div>
        }
      />

      <section className="border-b border-slate-100 px-5 py-4">
        <p className="text-sm text-slate-600">
          Groups approved products by HS code, origin, and tax profile into
          declaration lines. Download the CSV for customs review.
        </p>
        {groupings.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <SummaryPill label="Groups" value={String(groupings.length)} />
            <SummaryPill label="Products" value={String(totalProducts)} />
            <SummaryPill
              label="Total quantity"
              value={totalQuantity.toLocaleString()}
            />
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Ready to export
            </span>
          </div>
        ) : null}
      </section>

      {groupings.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <GroupIcon />
          </div>
          <p className="font-semibold text-slate-800">No declaration groups yet</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Approve all HS classifications first, then run grouping to build
            declaration lines for export.
          </p>
          <DashButton
            type="button"
            className="mt-4"
            onClick={handleGroup}
            disabled={grouping}
          >
            {grouping ? "Grouping…" : "Run grouping"}
          </DashButton>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Group</th>
                  <th className="px-3 py-3">HS code</th>
                  <th className="px-3 py-3">Origin</th>
                  <th className="px-3 py-3">Unit</th>
                  <th className="px-3 py-3">Duty</th>
                  <th className="px-3 py-3 text-right">Qty</th>
                  <th className="px-3 py-3 text-right">Products</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupings.map(({ grouping: g, products, totalQuantity: qty }) => {
                  const expanded = expandedGroupId === g.id;
                  const dutyRate =
                    formatDutyRateFromSnapshot(products[0]?.tariffSnapshot) ??
                    null;

                  return (
                    <GroupingTableRow
                      key={g.id}
                      group={g}
                      products={products}
                      totalQuantity={qty}
                      dutyRate={dutyRate}
                      expanded={expanded}
                      onToggle={() =>
                        setExpandedGroupId((current) =>
                          current === g.id ? null : g.id,
                        )
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          <section className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Export declaration CSV
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  File name: {caseNumber}-declaration.csv
                </p>
              </div>
              <DashButton
                type="button"
                variant="secondary"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? "Exporting…" : "Download CSV"}
              </DashButton>
            </div>
          </section>
        </>
      )}
    </DashCard>
  );
}

function GroupingTableRow({
  group,
  products,
  totalQuantity,
  dutyRate,
  expanded,
  onToggle,
}: {
  group: GroupingWithProducts["grouping"];
  products: GroupingWithProducts["products"];
  totalQuantity: number;
  dutyRate: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const status = group.status as GroupingStatus;

  return (
    <>
      <tr className="hover:bg-slate-50/60">
        <td className="px-5 py-3.5">
          <p className="font-mono text-xs font-semibold text-slate-500">
            {group.groupCode}
          </p>
          {group.procedureCode ? (
            <p className="mt-0.5 text-[11px] text-slate-400">
              Proc. {group.procedureCode}
            </p>
          ) : null}
        </td>
        <td className="px-3 py-3.5">
          {group.hsCode ? <HsCodeBadge code={group.hsCode} /> : "—"}
        </td>
        <td className="px-3 py-3.5 text-slate-600">
          {group.countryOfOriginCode
            ? getCountryLabel(group.countryOfOriginCode)
            : "—"}
        </td>
        <td className="px-3 py-3.5 text-slate-600">
          {group.unitOfMeasure ?? "—"}
        </td>
        <td className="px-3 py-3.5">
          {dutyRate ? (
            <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {dutyRate}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-3 py-3.5 text-right tabular-nums text-slate-800">
          {totalQuantity.toLocaleString()}
        </td>
        <td className="px-3 py-3.5 text-right tabular-nums text-slate-600">
          {products.length}
        </td>
        <td className="px-3 py-3.5">
          <StatusBadge
            label={GROUPING_STATUS_LABELS[status] ?? group.status}
            status={group.status}
          />
        </td>
        <td className="px-5 py-3.5 text-right">
          <button
            type="button"
            onClick={onToggle}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            {expanded ? "Hide" : "View"}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-slate-50/40">
          <td colSpan={9} className="px-5 py-4">
            {group.groupingReason ? (
              <p className="mb-3 text-xs text-slate-500">{group.groupingReason}</p>
            ) : null}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Products in group
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
              <table className="w-full min-w-120 text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map(({ product }) => (
                    <tr key={product.id}>
                      <td className="px-3 py-2 tabular-nums text-slate-500">
                        {product.productSequence}
                      </td>
                      <td className="px-3 py-2 max-w-md">
                        <TruncatedText
                          text={
                            product.normalizedDescription ??
                            product.rawDescription ??
                            "—"
                          }
                          className="text-slate-800"
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                        {product.quantity}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {product.unitOfMeasure}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
      <span className="font-semibold text-slate-900 tabular-nums">{value}</span>
      <span>{label}</span>
    </span>
  );
}

function GroupIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <title>Grouping</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}
