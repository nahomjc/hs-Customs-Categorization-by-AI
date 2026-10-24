"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pagination, usePagination } from "@/components/dashboard/Pagination";
import { BulkReviewToolbar } from "@/components/dashboard/import-case/BulkReviewActions";
import {
  HarmonizeProgressBanner,
  HarmonizeProgressDialog,
} from "@/components/dashboard/import-case/HarmonizeProgressDialog";
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
import type { JobSnapshot } from "@/lib/import-cases/harmonize-progress";
import type { CaseProductWithSources } from "@/lib/import-cases/product-queries";
import { useBulkReview } from "@/lib/import-cases/use-bulk-review";
import { useHarmonizeJob } from "@/lib/import-cases/use-harmonize-job";

type ProductsTabProps = {
  caseId: string;
  initialProducts: CaseProductWithSources[];
};

function productSearchHaystack(row: CaseProductWithSources): string {
  const p = row.product;
  return [
    p.normalizedDescription,
    p.rawDescription,
    p.productName,
    p.brand,
    p.modelNumber,
    String(p.productSequence),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function markPendingProductsVerified(
  rows: CaseProductWithSources[],
): CaseProductWithSources[] {
  return rows.map((row) =>
    row.product.humanVerified
      ? row
      : {
          ...row,
          product: {
            ...row.product,
            humanVerified: true,
            status: "ready_for_hs_suggestion",
          },
        },
  );
}

export function ProductsTab({ caseId, initialProducts }: ProductsTabProps) {
  const router = useRouter();
  const [products, setProducts] =
    useState<CaseProductWithSources[]>(initialProducts);
  const [progressOpen, setProgressOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function refreshProducts() {
    const res = await fetch(`/api/import-cases/${caseId}/products`, {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error("Failed to refresh products");
    }
    const data = (await res.json()) as {
      products: CaseProductWithSources[];
    };
    setProducts(data.products);
    router.refresh();
  }

  // Harmonization runs as short, resumable batches driven from here so the
  // dialog can show real progress (see lib/import-cases/harmonize-progress.ts).
  function handleJobFinished(snap: JobSnapshot) {
    setProgressOpen(true);
    if (snap.status === "success" && snap.summary) {
      const vddPart =
        snap.summary.vddMatchTotal > 0
          ? ` \u00b7 ${snap.summary.vddMatchTotal} VDD hit(s)`
          : "";
      toast.success(
        `Created ${snap.summary.productCount} harmonized product(s) (${snap.summary.matchCount} matched pairs)${vddPart}`,
      );
    } else if (snap.status === "failed") {
      toast.error(snap.fatalError ?? "Harmonization failed");
    }
    // show whatever was saved so far behind the dialog
    void refreshProducts();
  }

  const job = useHarmonizeJob(caseId, { onFinished: handleJobFinished });
  const harmonizing = job.active;

  function handleHarmonize() {
    setProgressOpen(true);
    job.start();
  }

  function handleProgressDone() {
    setProgressOpen(false);
    job.reset();
    void refreshProducts().catch((error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to refresh products",
      );
    });
  }

  async function handleConfirm(productId: string) {
    setConfirmingId(productId);
    try {
      const res = await fetch(
        `/api/import-cases/${caseId}/products/${productId}/confirm`,
        { method: "POST" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Confirm failed");
      toast.success("Product matching confirmed");
      await refreshProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Confirm failed");
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleSaveEdit(productId: string) {
    try {
      const res = await fetch(
        `/api/import-cases/${caseId}/products/${productId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ normalizedDescription: editDescription }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      toast.success("Product updated");
      setEditingId(null);
      await refreshProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  }

  const verifiedCount = products.filter((p) => p.product.humanVerified).length;
  const pendingCount = products.length - verifiedCount;

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((row) => productSearchHaystack(row).includes(q));
  }, [products, search]);

  const pagination = usePagination(filteredProducts.length);
  const pageProducts = filteredProducts.slice(pagination.start, pagination.end);

  const bulk = useBulkReview({
    caseId,
    endpoint: "products/bulk-review",
    itemLabel: "products",
    onSuccess: async ({ action, affectedCount }) => {
      if (
        (action === "approve" || action === "override") &&
        affectedCount > 0
      ) {
        setProducts((prev) => markPendingProductsVerified(prev));
      }
      try {
        await refreshProducts();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to refresh products",
        );
      }
    },
  });

  return (
    <div className="space-y-6">
      <DashCard>
        <DashCardHeader
          title="Harmonized products"
          action={
            <div className="flex flex-col items-end gap-2">
              <BulkReviewToolbar
                pendingCount={pendingCount}
                itemLabel="products"
                loading={bulk.loading || harmonizing}
                modalAction={bulk.modalAction}
                actionMessages={bulk.actionMessages}
                onActionClick={bulk.openModal}
                onModalOpenChange={(open) => !open && bulk.closeModal()}
                onConfirm={(payload) =>
                  bulk.modalAction
                    ? bulk.executeBulkReview(bulk.modalAction, payload)
                    : undefined
                }
              />
              <DashButton
                variant="primary"
                onClick={handleHarmonize}
                disabled={harmonizing}
              >
                {harmonizing
                  ? "Matching & harmonizing..."
                  : products.length > 0
                    ? "Re-harmonize"
                    : "Run harmonization"}
              </DashButton>
            </div>
          }
        />
        <div className="px-5 py-4 border-t border-slate-100">
          <p className="text-sm text-slate-600">
            Matches invoice lines with packing list lines and creates final
            product records. Original source lines are preserved. Human
            confirmation is required before HS classification.
          </p>
          {job.snapshot && !progressOpen ? (
            <HarmonizeProgressBanner
              snapshot={job.snapshot}
              onShow={() => setProgressOpen(true)}
            />
          ) : null}
          {products.length > 0 ? (
            <p className="text-xs text-slate-500 mt-2">
              {products.length} product(s) · {verifiedCount} human verified
            </p>
          ) : null}
        </div>
      </DashCard>

      <DashCard>
        {products.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="font-medium text-slate-700">No harmonized products yet</p>
            <p className="mt-2 text-sm">
              Click &quot;Run harmonization&quot; to match invoice and packing
              list lines into final products.
            </p>
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
                placeholder="Search products — description, brand, model, line #…"
                className={dashInputClass}
                aria-label="Search products"
              />
            </div>
            {search.trim() ? (
              <p className="mt-2 text-xs text-slate-500">
                {filteredProducts.length} of {products.length} product(s) match
              </p>
            ) : null}
          </div>
          <DashTable tableClassName="table-fixed text-xs">
            <colgroup>
              <col className="w-8" />
              <col className="w-[26%]" />
              <col className="w-14" />
              <col className="w-16" />
              <col className="w-[16%]" />
              <col className="w-[88px]" />
            </colgroup>
            <DashTableHead>
              <DashTableHeaderRow>
                <DashTh density="compact">#</DashTh>
                <DashTh density="compact">Product</DashTh>
                <DashTh density="compact">Qty</DashTh>
                <DashTh density="compact">Lines</DashTh>
                <DashTh density="compact">Status</DashTh>
                <DashTh density="compact" align="right">
                  Actions
                </DashTh>
              </DashTableHeaderRow>
            </DashTableHead>
            <DashTbody>
              {pageProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-sm text-slate-500"
                  >
                    No products match your search.
                  </td>
                </tr>
              ) : null}
              {pageProducts.map(
                ({ product, invoiceSources, packingSources, vddMatches }) => (
                  <ProductTableRow
                    key={product.id}
                    product={product}
                    invoiceSources={invoiceSources}
                    packingSources={packingSources}
                    vddMatches={vddMatches ?? []}
                    confirmingId={confirmingId}
                    editingId={editingId}
                    editDescription={editDescription}
                    expandedId={expandedId}
                    onConfirm={handleConfirm}
                    onStartEdit={(id, desc) => {
                      setEditingId(id);
                      setEditDescription(desc);
                    }}
                    onCancelEdit={() => setEditingId(null)}
                    onEditDescriptionChange={setEditDescription}
                    onSaveEdit={handleSaveEdit}
                    onToggleExpand={(id) =>
                      setExpandedId((prev) => (prev === id ? null : id))
                    }
                  />
                ),
              )}
            </DashTbody>
          </DashTable>
          <Pagination
            bounds={pagination}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
            itemLabel="products"
            note={
              pendingCount > 0
                ? `Approve all applies to every pending product (${pendingCount} total), not only this page.`
                : undefined
            }
          />
          </>
        )}
      </DashCard>

      <HarmonizeProgressDialog
        open={progressOpen && job.snapshot !== null}
        snapshot={job.snapshot}
        onHide={() => setProgressOpen(false)}
        onDone={handleProgressDone}
        onStop={job.stop}
        onResume={job.resume}
        onRetryFailed={job.retryFailed}
      />
    </div>
  );
}

type ProductTableRowProps = {
  product: CaseProductWithSources["product"];
  invoiceSources: CaseProductWithSources["invoiceSources"];
  packingSources: CaseProductWithSources["packingSources"];
  vddMatches: CaseProductWithSources["vddMatches"];
  confirmingId: string | null;
  editingId: string | null;
  editDescription: string;
  expandedId: string | null;
  onConfirm: (productId: string) => void;
  onStartEdit: (productId: string, description: string) => void;
  onCancelEdit: () => void;
  onEditDescriptionChange: (value: string) => void;
  onSaveEdit: (productId: string) => void;
  onToggleExpand: (productId: string) => void;
};

function ProductTableRow({
  product,
  invoiceSources,
  packingSources,
  vddMatches,
  confirmingId,
  editingId,
  editDescription,
  expandedId,
  onConfirm,
  onStartEdit,
  onCancelEdit,
  onEditDescriptionChange,
  onSaveEdit,
  onToggleExpand,
}: ProductTableRowProps) {
  const isEditing = editingId === product.id;
  const isExpanded = expandedId === product.id;
  const isConfirming = confirmingId === product.id;
  const description =
    product.normalizedDescription ?? product.rawDescription ?? "—";

  return (
    <>
      <tr className="border-b border-slate-50 hover:bg-slate-50/40 align-top">
        <td className="px-3 py-2 text-slate-500">{product.productSequence}</td>
        <td className="px-3 py-2 max-w-0">
          {isEditing ? (
            <textarea
              value={editDescription}
              onChange={(e) => onEditDescriptionChange(e.target.value)}
              rows={2}
              className={`${dashInputClass} pl-2 w-full text-xs`}
            />
          ) : (
            <>
              <TruncatedText
                text={description}
                className="font-medium text-slate-900"
              />
              {(product.brand || product.countryOfOriginCode) && (
                <TruncatedText
                  text={[product.brand, product.countryOfOriginCode]
                    .filter(Boolean)
                    .join(" · ")}
                  className="text-slate-400 mt-0.5"
                />
              )}
            </>
          )}
        </td>
        <td className="px-3 py-2 text-slate-600">
          {product.quantity ? (
            <>
              {product.quantity}
              <span className="block text-slate-400">
                {product.unitOfMeasure}
              </span>
            </>
          ) : (
            "—"
          )}
        </td>
        <td className="px-3 py-2">
          {invoiceSources.length > 0 || packingSources.length > 0 || vddMatches.length > 0 ? (
            <button
              type="button"
              onClick={() => onToggleExpand(product.id)}
              className="text-indigo-600 hover:underline text-left leading-snug"
            >
              {invoiceSources.length > 0
                ? `${invoiceSources.length} inv`
                : null}
              {invoiceSources.length > 0 && packingSources.length > 0
                ? " · "
                : null}
              {packingSources.length > 0
                ? `${packingSources.length} pkg`
                : null}
              {(invoiceSources.length > 0 || packingSources.length > 0) &&
              vddMatches.length > 0
                ? " · "
                : null}
              {vddMatches.length > 0 ? `${vddMatches.length} vdd` : null}
            </button>
          ) : (
            "—"
          )}
        </td>
        <td className="px-3 py-2">
          {product.humanVerified ? (
            <StatusBadge label="Verified" status="completed" />
          ) : (
            <StatusBadge label="Pending" status="needs_review" />
          )}
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-col items-end gap-1">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => onSaveEdit(product.id)}
                  className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-2.5 py-1 w-full"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="text-xs font-medium text-slate-600 w-full text-center"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {!product.humanVerified ? (
                  <button
                    type="button"
                    onClick={() => onConfirm(product.id)}
                    disabled={isConfirming}
                    className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg px-2.5 py-1 w-full"
                  >
                    {isConfirming ? "..." : "Confirm"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onStartEdit(product.id, description)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 w-full text-center"
                >
                  Edit
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {isExpanded ? (
        <tr className="border-b border-slate-100 bg-slate-50/60">
          <td colSpan={6} className="px-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <SourceDetail
                title="Invoice source line(s)"
                sources={invoiceSources.map((s) => ({
                  description: s.line.supplierDescription,
                  qty: `${s.line.quantity} ${s.line.unitOfMeasure}`,
                  confidence: s.link.matchConfidence,
                }))}
              />
              <SourceDetail
                title="Packing list source line(s)"
                sources={packingSources.map((s) => ({
                  description: s.line.supplierDescription,
                  qty: `${s.line.quantity} ${s.line.unitOfMeasure}`,
                  confidence: s.link.matchConfidence,
                }))}
              />
            </div>
            <VddMatchesPanel matches={vddMatches} />
            {Array.isArray(product.missingInformation) &&
            (product.missingInformation as string[]).length > 0 ? (
              <p className="text-xs text-amber-700 mt-3">
                Missing:{" "}
                {(product.missingInformation as string[]).join(", ")}
              </p>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function SourceDetail({
  title,
  sources,
}: {
  title: string;
  sources: Array<{
    description: string;
    qty: string;
    confidence: string | null;
  }>;
}) {
  if (sources.length === 0) {
    return (
      <div>
        <p className="font-semibold text-slate-500 mb-1">{title}</p>
        <p className="text-slate-400">No linked lines</p>
      </div>
    );
  }

  return (
    <div>
      <p className="font-semibold text-slate-500 mb-2">{title}</p>
      <ul className="space-y-1.5">
        {sources.map((s) => (
          <li
            key={`${s.description}-${s.qty}`}
            className="text-slate-700 bg-white rounded-lg px-3 py-2 border border-slate-100"
          >
            <p>{s.description}</p>
            <p className="text-slate-400 mt-0.5">{s.qty}</p>
            {s.confidence ? (
              <p className="text-slate-400">
                Match: {(Number(s.confidence) * 100).toFixed(0)}%
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VddMatchesPanel({
  matches,
}: {
  matches: CaseProductWithSources["vddMatches"];
}) {
  return (
    <div className="mt-4 text-xs">
      <p className="font-semibold text-slate-500 mb-1">Similar VDD records</p>
      <p className="text-slate-400 mb-2">
        VDD references support review only. They do not determine the final HS
        code or customs value.
      </p>
      {matches.length === 0 ? (
        <p className="text-slate-400">
          No VDD matches yet. Import VDD Excel under Settings → VDD, then
          re-harmonize.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {matches.map((m) => (
            <li
              key={m.id}
              className="text-slate-700 bg-white rounded-lg px-3 py-2 border border-slate-100"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  HS {m.hsCode}
                  {m.hsCodeMatches === true ? (
                    <span className="ml-2 text-emerald-600 font-normal">
                      agrees with suggestion
                    </span>
                  ) : m.hsCodeMatches === false ? (
                    <span className="ml-2 text-amber-600 font-normal">
                      differs from suggestion
                    </span>
                  ) : null}
                </p>
                <p className="text-slate-500">
                  {(Number(m.similarityScore) * 100).toFixed(0)}% similar
                </p>
              </div>
              <p className="mt-0.5">
                {[m.brandOrMake, m.model].filter(Boolean).join(" · ") || "—"}
                {m.originCode ? ` · ${m.originCode}` : ""}
              </p>
              <p className="text-slate-500 mt-0.5">
                {m.commonName ?? m.commercialDescription ?? "—"}
              </p>
              {m.declaredUnitPrice != null ? (
                <p className="text-slate-400 mt-0.5">
                  Declared{" "}
                  {m.currencyCode} {m.declaredUnitPrice}
                  {m.unitOfQuantity ? ` / ${m.unitOfQuantity}` : ""}
                </p>
              ) : null}
              {m.matchReasons.length > 0 ? (
                <p className="text-emerald-700 mt-1">
                  Match: {m.matchReasons.join(", ")}
                </p>
              ) : null}
              {m.differences.length > 0 ? (
                <p className="text-amber-700 mt-0.5">
                  Diff: {m.differences.join("; ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
