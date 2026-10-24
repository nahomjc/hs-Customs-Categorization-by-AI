"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pagination, usePagination } from "@/components/dashboard/Pagination";
import { HsCodeBadge } from "@/components/dashboard/document/HsCodeBadge";
import {
  GroupingProgressBanner,
  GroupingProgressDialog,
} from "@/components/dashboard/import-case/GroupingProgressDialog";
import { RerunWorkflowJobDialog } from "@/components/dashboard/import-case/RerunWorkflowJobDialog";
import {
  DashButton,
  DashCard,
  DashCardHeader,
  DashTable,
  DashTableHead,
  DashTableHeaderRow,
  DashTbody,
  DashTh,
  StatusBadge,
  TruncatedText,
  dashInputClass,
} from "@/components/dashboard/ui";
import { getCountryLabel } from "@/lib/countries";
import { formatHsCode } from "@/lib/hs-code-format";
import { displayOrigin, ORIGIN_NOT_PROVIDED } from "@/lib/import-cases/origin";
import type { UnclassifiedProduct } from "@/lib/import-cases/unclassified";
import {
  GROUPING_STATUS_LABELS,
  type GroupingStatus,
} from "@/lib/import-cases/constants";
import { formatDutyRateFromSnapshot } from "@/lib/import-cases/duty-rate-display";
import type { GroupingSnapshot } from "@/lib/import-cases/grouping-progress";
import type { GroupingWithProducts } from "@/lib/import-cases/grouping-queries";
import { useGroupingJob } from "@/lib/import-cases/use-grouping-job";
import { useSyncServerProp } from "@/lib/import-cases/use-sync-server-prop";

type GroupingExportTabProps = {
  caseId: string;
  caseNumber: string;
  initialGroupings: GroupingWithProducts[];
  /** Products that are in no group: listed with a warning, also in the CSV. */
  initialUnclassified?: UnclassifiedProduct[];
};

/** Country name from a stored code, or "Not provided" (never "UNK"). */
function originLabel(code: string | null | undefined): string {
  const shown = displayOrigin(code);
  return shown === ORIGIN_NOT_PROVIDED ? shown : getCountryLabel(shown);
}

function groupingSearchHaystack(row: GroupingWithProducts): string {
  const g = row.grouping;
  const originLabel = g.countryOfOriginCode
    ? getCountryLabel(g.countryOfOriginCode)
    : null;
  const status = g.status as GroupingStatus;
  const statusLabel = GROUPING_STATUS_LABELS[status] ?? g.status;
  const productBits = row.products.flatMap(({ product }) => [
    product.normalizedDescription,
    product.rawDescription,
    product.productName,
    String(product.productSequence),
  ]);
  return [
    g.groupCode,
    g.hsCode,
    g.countryOfOriginCode,
    originLabel,
    g.unitOfMeasure,
    g.procedureCode,
    g.groupingReason,
    g.status,
    statusLabel,
    ...productBits,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function GroupingExportTab({
  caseId,
  caseNumber,
  initialGroupings,
  initialUnclassified = [],
}: GroupingExportTabProps) {
  const router = useRouter();
  const [groupings, setGroupings] =
    useState<GroupingWithProducts[]>(initialGroupings);
  useSyncServerProp(initialGroupings, setGroupings);
  const [unclassified, setUnclassified] =
    useState<UnclassifiedProduct[]>(initialUnclassified);
  useSyncServerProp(initialUnclassified, setUnclassified);
  const [progressOpen, setProgressOpen] = useState(false);
  const [rerunConfirmOpen, setRerunConfirmOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredGroupings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groupings;
    return groupings.filter((row) => groupingSearchHaystack(row).includes(q));
  }, [groupings, search]);

  const pagination = usePagination(filteredGroupings.length);
  const pageGroupings = filteredGroupings.slice(
    pagination.start,
    pagination.end,
  );

  const totalProducts = useMemo(
    () => groupings.reduce((sum, g) => sum + g.products.length, 0),
    [groupings],
  );
  const totalQuantity = useMemo(
    () => groupings.reduce((sum, g) => sum + g.totalQuantity, 0),
    [groupings],
  );

  async function refresh() {
    const res = await fetch(`/api/import-cases/${caseId}/groupings`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      groupings: GroupingWithProducts[];
    };
    setGroupings(data.groupings);
    router.refresh();
  }

  // Grouping runs as short, resumable batches driven from here so the dialog
  // can show real progress (see lib/import-cases/grouping-progress.ts).
  function handleJobFinished(snap: GroupingSnapshot) {
    setProgressOpen(true);
    if (snap.status === "success" && snap.summary) {
      toast.success(
        `Created ${snap.summary.groupCount} declaration group(s) from ${snap.summary.productCount} product(s)`,
      );
    } else if (snap.status === "failed") {
      toast.error(snap.fatalError ?? "Grouping failed");
    }
    // show whatever was saved so far behind the dialog
    void refresh();
  }

  const job = useGroupingJob(caseId, { onFinished: handleJobFinished });
  const grouping = job.active;

  function startGroupingJob() {
    setProgressOpen(true);
    job.start();
  }

  function handleGroup() {
    if (groupings.length > 0) {
      setRerunConfirmOpen(true);
      return;
    }
    startGroupingJob();
  }

  function confirmRerunGrouping() {
    setRerunConfirmOpen(false);
    startGroupingJob();
  }

  function handleProgressDone() {
    setProgressOpen(false);
    job.reset();
    void refresh();
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
        {job.snapshot && !progressOpen ? (
          <div className="mt-3">
            <GroupingProgressBanner
              snapshot={job.snapshot}
              onShow={() => setProgressOpen(true)}
            />
          </div>
        ) : null}
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

      {unclassified.length > 0 ? (
        <section
          className="border-b border-slate-100 px-5 py-4"
          aria-label="Products without a declaration group"
        >
          <div
            className="whitespace-normal rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800"
            role="alert"
          >
            <p className="font-medium">
              {unclassified.length} product(s) are not in any declaration group
            </p>
            <p className="mt-0.5">
              They are not covered by the groups below. The CSV lists them in a
              separate Unclassified section, so nothing is dropped silently.
              Approve their HS codes in the classification step, then run
              grouping again.
            </p>
            <details className="mt-1.5">
              <summary className="cursor-pointer select-none font-medium">
                Show the products
              </summary>
              <ul className="mt-1.5 space-y-0.5">
                {unclassified.map((u) => (
                  <li key={u.productId} className="min-w-0 truncate">
                    <span className="text-amber-700">#{u.sequence}</span>{" "}
                    {u.description || "Product"}
                    {u.hsCode ? (
                      <span className="font-mono text-slate-900">
                        {" "}
                        {formatHsCode(u.hsCode).display}
                      </span>
                    ) : null}{" "}
                    - {u.reason}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </section>
      ) : null}

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
          <div className="border-b border-slate-100 px-5 py-3">
            <div className="relative max-w-md">
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
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
                onChange={(e) => {
                  setSearch(e.target.value);
                  pagination.reset();
                }}
                placeholder="Search groups — HS code, origin, group code, product description…"
                className={dashInputClass}
                aria-label="Search declaration groups"
              />
            </div>
            {search.trim() ? (
              <p className="mt-2 text-xs text-slate-500">
                {filteredGroupings.length} of {groupings.length} group(s) match
              </p>
            ) : null}
          </div>
          <DashTable tableClassName="min-w-160">
            <DashTableHead>
              <DashTableHeaderRow>
                <DashTh>Group</DashTh>
                <DashTh>HS code</DashTh>
                <DashTh>Origin</DashTh>
                <DashTh>Unit</DashTh>
                <DashTh>Duty</DashTh>
                <DashTh align="right">Qty</DashTh>
                <DashTh align="right">Products</DashTh>
                <DashTh>Status</DashTh>
                <DashTh align="right">Details</DashTh>
              </DashTableHeaderRow>
            </DashTableHead>
            <DashTbody>
              {pageGroupings.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-8 text-center text-sm text-slate-500"
                  >
                    No groups match your search.
                  </td>
                </tr>
              ) : null}
              {pageGroupings.map(({ grouping: g, products, totalQuantity: qty }) => {
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
            </DashTbody>
          </DashTable>
          <Pagination
            bounds={pagination}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
            itemLabel="groups"
          />

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
      <GroupingProgressDialog
        open={progressOpen && job.snapshot !== null}
        snapshot={job.snapshot}
        onHide={() => setProgressOpen(false)}
        onDone={handleProgressDone}
        onStop={job.stop}
        onResume={job.resume}
        onRetryFailed={job.retryFailed}
      />

      <RerunWorkflowJobDialog
        job="grouping"
        open={rerunConfirmOpen}
        onOpenChange={setRerunConfirmOpen}
        onConfirm={confirmRerunGrouping}
        loading={grouping}
      />
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
          {group.hsCode ? (
            <>
              <HsCodeBadge code={formatHsCode(group.hsCode).display} />
              {formatHsCode(group.hsCode).incomplete ? (
                <p className="mt-0.5 text-[11px] text-amber-700">
                  Incomplete code (under 8 digits)
                </p>
              ) : null}
            </>
          ) : (
            "-"
          )}
        </td>
        <td className="px-3 py-3.5 text-slate-600">
          {originLabel(group.countryOfOriginCode)}
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
