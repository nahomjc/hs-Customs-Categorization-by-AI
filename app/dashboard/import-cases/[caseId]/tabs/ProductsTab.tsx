"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { BulkReviewToolbar } from "@/components/dashboard/import-case/BulkReviewActions";
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
import type { CaseProductWithSources } from "@/lib/import-cases/product-queries";
import { useBulkReview } from "@/lib/import-cases/use-bulk-review";

type ProductsTabProps = {
  caseId: string;
  initialProducts: CaseProductWithSources[];
};

export function ProductsTab({ caseId, initialProducts }: ProductsTabProps) {
  const router = useRouter();
  const [products, setProducts] =
    useState<CaseProductWithSources[]>(initialProducts);
  const [harmonizing, setHarmonizing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function refreshProducts() {
    const res = await fetch(`/api/import-cases/${caseId}/products`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      products: CaseProductWithSources[];
    };
    setProducts(data.products);
    router.refresh();
  }

  async function handleHarmonize() {
    setHarmonizing(true);
    try {
      const res = await fetch(`/api/import-cases/${caseId}/harmonize`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        error?: string;
        productCount?: number;
        matchCount?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "Harmonization failed");
      toast.success(
        `Created ${data.productCount} harmonized product(s) (${data.matchCount} matched pairs)`,
      );
      await refreshProducts();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Harmonization failed",
      );
    } finally {
      setHarmonizing(false);
    }
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
  const bulk = useBulkReview({
    caseId,
    endpoint: "products/bulk-review",
    itemLabel: "products",
    onSuccess: refreshProducts,
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
                loading={bulk.loading}
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
              {products.map(
                ({ product, invoiceSources, packingSources }) => (
                  <ProductTableRow
                    key={product.id}
                    product={product}
                    invoiceSources={invoiceSources}
                    packingSources={packingSources}
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
        )}
      </DashCard>
    </div>
  );
}

type ProductTableRowProps = {
  product: CaseProductWithSources["product"];
  invoiceSources: CaseProductWithSources["invoiceSources"];
  packingSources: CaseProductWithSources["packingSources"];
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
          {invoiceSources.length > 0 || packingSources.length > 0 ? (
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
