"use client";

import Link from "next/link";
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
import type { ProductClassificationBundle } from "@/lib/import-cases/classification-queries";
import type { ClassificationSource } from "@/lib/import-cases/constants";
import { formatDutyRateFromSnapshot } from "@/lib/import-cases/duty-rate-display";
import { useBulkReview } from "@/lib/import-cases/use-bulk-review";

type ClassificationTabProps = {
  caseId: string;
  initialClassifications: ProductClassificationBundle[];
  referencePopulated: boolean;
};

function sourceLabel(source: string | null | undefined): string {
  switch (source as ClassificationSource | "rule_fallback" | undefined) {
    case "reference_match":
      return "Reference";
    case "ai_suggestion":
      return "AI";
    case "expert_review":
      return "Rules";
    case "manual_override":
      return "Manual";
    default:
      return "—";
  }
}

function sourceBadgeStatus(source: string | null | undefined): string {
  switch (source) {
    case "reference_match":
      return "approved";
    case "ai_suggestion":
      return "ai_processed";
    case "expert_review":
      return "needs_review";
    case "manual_override":
      return "reviewed";
    default:
      return "pending";
  }
}

export function ClassificationTab({
  caseId,
  initialClassifications,
  referencePopulated: initialReferencePopulated,
}: ClassificationTabProps) {
  const router = useRouter();
  const [items, setItems] =
    useState<ProductClassificationBundle[]>(initialClassifications);
  const [referencePopulated, setReferencePopulated] = useState(
    initialReferencePopulated,
  );
  const [classifying, setClassifying] = useState(false);
  const [aiProductId, setAiProductId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [overrideHsCode, setOverrideHsCode] = useState("");

  async function refresh() {
    const res = await fetch(`/api/import-cases/${caseId}/classifications`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      classifications: ProductClassificationBundle[];
      referencePopulated?: boolean;
    };
    setItems(data.classifications);
    if (data.referencePopulated != null) {
      setReferencePopulated(data.referencePopulated);
    }
    router.refresh();
  }

  async function handleClassify() {
    setClassifying(true);
    try {
      const res = await fetch(`/api/import-cases/${caseId}/classify`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        error?: string;
        classifiedCount?: number;
        needsReviewCount?: number;
        referencePopulated?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? "Classification failed");
      if (data.referencePopulated != null) {
        setReferencePopulated(data.referencePopulated);
      }
      toast.success(
        `Classified ${data.classifiedCount} product(s)${data.needsReviewCount ? `, ${data.needsReviewCount} need review` : ""}`,
      );
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Classification failed",
      );
    } finally {
      setClassifying(false);
    }
  }

  async function handleAskAi(productId: string) {
    setAiProductId(productId);
    try {
      const res = await fetch(
        `/api/import-cases/${caseId}/products/${productId}/classify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forceAi: true }),
        },
      );
      const data = (await res.json()) as {
        error?: string;
        hsCode?: string | null;
        needsReview?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? "AI classification failed");
      if (data.hsCode && !data.hsCode.startsWith("9999")) {
        toast.success(`AI suggested HS ${data.hsCode}`);
      } else if (data.hsCode?.startsWith("9999")) {
        toast.warning(
          `AI returned unclassified (9999) — try uploading the tariff book or set HS manually`,
        );
      } else {
        toast.warning(
          "AI could not classify this item — set HS manually or review the description",
        );
      }
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "AI classification failed",
      );
    } finally {
      setAiProductId(null);
    }
  }

  async function handleApprove(
    productId: string,
    candidateId?: string,
    hsCode?: string,
  ) {
    setApprovingId(productId);
    try {
      const res = await fetch(
        `/api/import-cases/${caseId}/products/${productId}/approve-classification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            candidateId ? { candidateId } : { hsCode },
          ),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Approval failed");
      toast.success("HS classification approved");
      setOverrideId(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Approval failed");
    } finally {
      setApprovingId(null);
    }
  }

  const verifiedProducts = items.filter((i) => i.product.humanVerified);
  const tableRows = verifiedProducts;
  const withClassification = verifiedProducts.filter((i) => i.classification);
  const approvedCount = verifiedProducts.filter(
    (i) => i.classification?.isFinal,
  ).length;
  const unclassifiedCount = verifiedProducts.filter(
    (i) => !i.classification && i.candidates.length === 0,
  ).length;
  const pendingCount = verifiedProducts.filter(
    (i) => !i.classification?.isFinal,
  ).length;
  const bulk = useBulkReview({
    caseId,
    endpoint: "classifications/bulk-review",
    itemLabel: "classifications",
    onSuccess: refresh,
  });

  return (
    <div className="space-y-6">
      <DashCard>
        <DashCardHeader
          title="HS classification"
          action={
            <div className="flex flex-col items-end gap-2">
              <BulkReviewToolbar
                pendingCount={pendingCount}
                itemLabel="classifications"
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
                overrideField={{
                  label: "HS code for all pending products",
                  placeholder: "e.g. 9405.10",
                  required: true,
                }}
              />
              <DashButton
                variant="primary"
                onClick={handleClassify}
                disabled={classifying || verifiedProducts.length === 0}
              >
                {classifying
                  ? "Classifying..."
                  : withClassification.length > 0
                    ? "Re-classify"
                    : "Run classification"}
              </DashButton>
            </div>
          }
        />
        <div className="px-5 py-4 border-t border-slate-100 space-y-2">
          <p className="text-sm text-slate-600">
            Matches products against the tariff reference table first. Use{" "}
            <span className="font-medium">Ask AI</span> on any row to skip the
            reference and get an OpenRouter suggestion instead. Human approval
            is required before declaration grouping.
          </p>
          {!referencePopulated ? (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              HS reference table is empty — upload the tariff book at{" "}
              <Link
                href="/dashboard/hs-reference"
                className="font-medium underline"
              >
                HS Reference
              </Link>{" "}
              for better accuracy. Classification will use external AI only.
            </p>
          ) : (
            <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              Tariff reference loaded — products will be matched against your
              uploaded HS reference first.
            </p>
          )}
          {verifiedProducts.length > 0 ? (
            <p className="text-xs text-slate-500">
              {verifiedProducts.length} product(s) · {withClassification.length}{" "}
              classified · {approvedCount} approved
              {unclassifiedCount > 0
                ? ` · ${unclassifiedCount} need manual HS`
                : ""}
            </p>
          ) : null}
        </div>
      </DashCard>

      <DashCard>
        {verifiedProducts.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="font-medium text-slate-700">
              No verified products yet
            </p>
            <p className="mt-2 text-sm">
              Go back to Products and confirm matching before classification.
            </p>
          </div>
        ) : tableRows.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="font-medium text-slate-700">
              No HS suggestions yet
            </p>
            <p className="mt-2 text-sm">
              Click &quot;Run classification&quot; to generate HS code
              candidates.
            </p>
          </div>
        ) : (
          <DashTable tableClassName="table-fixed text-xs">
            <colgroup>
              <col className="w-8" />
              <col className="w-[22%]" />
              <col className="w-[32%]" />
              <col className="w-[16%]" />
              <col className="w-[160px]" />
            </colgroup>
            <DashTableHead>
              <DashTableHeaderRow>
                <DashTh density="compact">#</DashTh>
                <DashTh density="compact">Product</DashTh>
                <DashTh density="compact">HS / Tariff</DashTh>
                <DashTh density="compact">Source</DashTh>
                <DashTh density="compact" align="right">
                  Actions
                </DashTh>
              </DashTableHeaderRow>
            </DashTableHead>
            <DashTbody>
              {tableRows.map(
                ({ product, candidates, classification, tariffSnapshot }) => (
                  <ClassificationTableRow
                    key={product.id}
                    product={product}
                    candidates={candidates}
                    classification={classification}
                    tariffSnapshot={tariffSnapshot}
                    approvingId={approvingId}
                    aiProductId={aiProductId}
                    overrideId={overrideId}
                    overrideHsCode={overrideHsCode}
                    onApprove={handleApprove}
                    onAskAi={handleAskAi}
                    onStartOverride={(id, hsCode) => {
                      setOverrideId(id);
                      setOverrideHsCode(hsCode);
                    }}
                    onCancelOverride={() => setOverrideId(null)}
                    onOverrideHsCodeChange={setOverrideHsCode}
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

type ClassificationTableRowProps = {
  product: ProductClassificationBundle["product"];
  candidates: ProductClassificationBundle["candidates"];
  classification: ProductClassificationBundle["classification"];
  tariffSnapshot: ProductClassificationBundle["tariffSnapshot"];
  approvingId: string | null;
  aiProductId: string | null;
  overrideId: string | null;
  overrideHsCode: string;
  onApprove: (productId: string, candidateId?: string, hsCode?: string) => void;
  onAskAi: (productId: string) => void;
  onStartOverride: (productId: string, hsCode: string) => void;
  onCancelOverride: () => void;
  onOverrideHsCodeChange: (value: string) => void;
};

function ClassificationTableRow({
  product,
  candidates,
  classification,
  tariffSnapshot,
  approvingId,
  aiProductId,
  overrideId,
  overrideHsCode,
  onApprove,
  onAskAi,
  onStartOverride,
  onCancelOverride,
  onOverrideHsCodeChange,
}: ClassificationTableRowProps) {
  const description =
    product.normalizedDescription ?? product.rawDescription ?? "—";
  const isOverriding = overrideId === product.id;
  const isApproving = approvingId === product.id;
  const isAskingAi = aiProductId === product.id;

  return (
    <>
      <tr className="border-b border-slate-50 hover:bg-slate-50/40 align-top">
        <td className="px-3 py-2 text-slate-500">{product.productSequence}</td>
        <td className="px-3 py-2 max-w-0">
          <div className="flex items-start gap-1 min-w-0">
            <TruncatedText
              text={description}
              className="font-medium text-slate-900 min-w-0 flex-1"
            />
            {description !== "—" ? (
              <CopyProductNameButton text={description} />
            ) : null}
          </div>
          {product.quantity ? (
            <p className="text-slate-400 mt-0.5 truncate" title={`${product.quantity} ${product.unitOfMeasure ?? ""}`}>
              {product.quantity} {product.unitOfMeasure ?? ""}
            </p>
          ) : null}
        </td>
        <td className="px-3 py-2 max-w-0">
          <p className="font-mono font-semibold text-indigo-700 truncate" title={classification?.hsCode ?? undefined}>
            {classification?.hsCode ?? "—"}
          </p>
          <TruncatedText
            text={classification?.officialDescription ?? "—"}
            className="text-slate-500 mt-0.5"
          />
          <p className="text-slate-400 mt-0.5 truncate">
            {(() => {
              const duty = formatDutyRateFromSnapshot(tariffSnapshot);
              const parts = [
                classification?.classificationBasis,
                duty ? `${duty} duty` : null,
              ].filter(Boolean);
              return parts.length > 0 ? parts.join(" · ") : null;
            })()}
          </p>
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-wrap items-center gap-1">
            {classification ? (
              <StatusBadge
                label={sourceLabel(classification.source)}
                status={sourceBadgeStatus(classification.source)}
              />
            ) : null}
            {classification?.isFinal ? (
              <StatusBadge label="Approved" status="approved" />
            ) : classification ? (
              <StatusBadge label="Pending" status="needs_review" />
            ) : product.status === "needs_expert_review" ? (
              <StatusBadge label="Expert review" status="warning" />
            ) : (
              <StatusBadge label="Not classified" status="uploaded" />
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          {!classification?.isFinal ? (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => onAskAi(product.id)}
                disabled={isAskingAi || isApproving}
                className="text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 rounded-lg px-2.5 py-1 whitespace-nowrap"
                title="Skip tariff reference and classify with OpenRouter AI"
              >
                {isAskingAi ? "..." : "Ask AI"}
              </button>
              {classification ? (
                <button
                  type="button"
                  onClick={() =>
                    onApprove(
                      product.id,
                      classification.selectedCandidateId ?? candidates[0]?.id,
                    )
                  }
                  disabled={isApproving}
                  className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg px-2.5 py-1 whitespace-nowrap"
                >
                  {isApproving ? "..." : "Approve"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  onStartOverride(product.id, classification?.hsCode ?? "")
                }
                className="text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg px-2.5 py-1 whitespace-nowrap"
              >
                {classification ? "Override" : "Set HS"}
              </button>
            </div>
          ) : null}
        </td>
      </tr>
      {isOverriding ? (
        <tr className="border-b border-slate-100 bg-slate-50/80">
          <td colSpan={5} className="px-3 py-2">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-0">
                <label
                  htmlFor={`override-hs-${product.id}`}
                  className="text-slate-500"
                >
                  Manual HS code
                </label>
                <input
                  id={`override-hs-${product.id}`}
                  value={overrideHsCode}
                  onChange={(e) => onOverrideHsCodeChange(e.target.value)}
                  className={`${dashInputClass} pl-3 w-full mt-1 text-sm`}
                  placeholder="e.g. 9405.10"
                />
              </div>
              <DashButton
                onClick={() => onApprove(product.id, undefined, overrideHsCode)}
                disabled={!overrideHsCode.trim() || isApproving}
                className="text-xs px-3 py-1.5"
              >
                Save
              </DashButton>
              <DashButton
                variant="secondary"
                onClick={onCancelOverride}
                className="text-xs px-3 py-1.5"
              >
                Cancel
              </DashButton>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function CopyProductNameButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Product name copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      title={copied ? "Copied" : "Copy product name"}
      aria-label={copied ? "Copied product name" : "Copy product name"}
    >
      {copied ? (
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <title>Copied</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <title>Copy</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}
