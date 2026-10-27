"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Pagination, usePagination } from "@/components/dashboard/Pagination";
import { BulkReviewToolbar } from "@/components/dashboard/import-case/BulkReviewActions";
import {
  ClassifyProgressBanner,
  ClassifyProgressDialog,
} from "@/components/dashboard/import-case/ClassifyProgressDialog";
import { ClassificationDecisionDialog } from "@/components/dashboard/import-case/ClassificationDecisionDialog";
import { RerunWorkflowJobDialog } from "@/components/dashboard/import-case/RerunWorkflowJobDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DashButton,
  DashCard,
  DashCardHeader,
  DashTable,
  DashTableBusy,
  DashTableHead,
  DashTableHeaderRow,
  DashTbody,
  DashTh,
  StatusBadge,
  TruncatedText,
  dashInputClass,
} from "@/components/dashboard/ui";
import type { ProductClassificationBundle } from "@/lib/import-cases/classification-queries";
import type { ClassifySnapshot } from "@/lib/import-cases/classify-progress";
import type { ClassificationSource } from "@/lib/import-cases/constants";
import { isCatchAllHsCode } from "@/lib/hs-catch-all";
import { getReviewerNote } from "@/lib/import-cases/product-context";
import {
  buildClassificationReviewView,
  type ClassificationReviewView,
} from "@/lib/import-cases/classification-review-view";
import { formatDutyRateFromSnapshot } from "@/lib/import-cases/duty-rate-display";
import { useBulkReview } from "@/lib/import-cases/use-bulk-review";
import { useClassifyJob } from "@/lib/import-cases/use-classify-job";
import { useSyncServerProp } from "@/lib/import-cases/use-sync-server-prop";
import {
  useWorkflowJobGuard,
  type WorkflowJobGuardPayload,
} from "@/lib/import-cases/use-workflow-job-guard";
import { needsRecheck } from "@/lib/hs-plausibility";
import { formatHsCode } from "@/lib/hs-code-format";

type ClassificationTabProps = {
  caseId: string;
  classifications: ProductClassificationBundle[];
  referencePopulated: boolean;
  onClassificationsChange?: (items: ProductClassificationBundle[]) => void;
  onWorkflowJobGuard?: (guard: WorkflowJobGuardPayload | null) => void;
  /** Opens the grouping step (used after an approved code was changed). */
  onGoToGrouping?: () => void;
};

function classificationSearchHaystack(row: ProductClassificationBundle): string {
  const { product, classification } = row;
  return [
    product.normalizedDescription,
    product.rawDescription,
    product.productName,
    product.brand,
    product.modelNumber,
    String(product.productSequence),
    classification?.hsCode,
    classification?.officialDescription,
    classification?.classificationBasis,
    classification?.source,
    classification?.source ? sourceLabel(classification.source) : null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

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

function needsExpertReview(row: ProductClassificationBundle): boolean {
  const { product, classification } = row;
  if (classification?.isFinal) return false;
  if (product.status === "needs_expert_review") return true;
  if (classification?.source === "expert_review") return true;
  return false;
}

function isUnclassified(row: ProductClassificationBundle): boolean {
  const { classification, candidates } = row;
  return (
    (!classification && candidates.length === 0) ||
    (classification != null && isCatchAllHsCode(classification.hsCode))
  );
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
  classifications: classificationsFromParent,
  referencePopulated: initialReferencePopulated,
  onClassificationsChange,
  onWorkflowJobGuard,
  onGoToGrouping,
}: ClassificationTabProps) {
  const router = useRouter();
  const [items, setItems] =
    useState<ProductClassificationBundle[]>(classificationsFromParent);
  useSyncServerProp(classificationsFromParent, setItems);
  const [search, setSearch] = useState("");
  const [referencePopulated, setReferencePopulated] = useState(
    initialReferencePopulated,
  );
  useSyncServerProp(initialReferencePopulated, setReferencePopulated);
  const [progressOpen, setProgressOpen] = useState(false);
  const [rerunConfirmOpen, setRerunConfirmOpen] = useState(false);
  const [aiProductId, setAiProductId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [overrideHsCode, setOverrideHsCode] = useState("");
  const [expertModalOpen, setExpertModalOpen] = useState(false);
  const [unclassifiedModalOpen, setUnclassifiedModalOpen] = useState(false);
  const [decisionModal, setDecisionModal] = useState<{
    productId: string;
    productSequence: number;
    productLabel: string;
    currentHsCode: string | null;
    review: ClassificationReviewView;
  } | null>(null);

  async function refresh(): Promise<ProductClassificationBundle[] | null> {
    const res = await fetch(`/api/import-cases/${caseId}/classifications`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      classifications: ProductClassificationBundle[];
      referencePopulated?: boolean;
    };
    setItems(data.classifications);
    onClassificationsChange?.(data.classifications);
    if (data.referencePopulated != null) {
      setReferencePopulated(data.referencePopulated);
    }
    router.refresh();
    return data.classifications;
  }

  function presentDecisionModal(row: ProductClassificationBundle) {
    const review = buildClassificationReviewView(
      row.candidates,
      row.classification,
    );
    if (!review.decisionRequired) return;
    setDecisionModal({
      productId: row.product.id,
      productSequence: row.product.productSequence,
      productLabel:
        row.product.normalizedDescription ??
        row.product.rawDescription ??
        row.product.productName ??
        "Product",
      currentHsCode: row.classification?.hsCode ?? null,
      review,
    });
  }

  // Classification runs as short, resumable batches driven from here so the
  // dialog can show real progress (see lib/import-cases/classify-progress.ts).
  function handleJobFinished(snap: ClassifySnapshot) {
    setProgressOpen(true);
    if (snap.status === "success" && snap.summary) {
      setReferencePopulated(snap.summary.referencePopulated);
      toast.success(
        `Classified ${snap.summary.classifiedCount} product(s)${snap.summary.needsReviewCount ? `, ${snap.summary.needsReviewCount} need review` : ""}`,
      );
    } else if (snap.status === "failed") {
      toast.error(snap.fatalError ?? "Classification failed");
    }
    // show whatever was saved so far behind the dialog
    void refresh();
  }

  // "suspicious" = the re-check run: only codes that do not fit their product.
  const scopeRef = useRef<"suspicious" | undefined>(undefined);
  const job = useClassifyJob(caseId, {
    onFinished: handleJobFinished,
    getScope: () => scopeRef.current,
  });
  const classifying = job.active;
  useWorkflowJobGuard(
    classifying,
    "HS classification",
    job.stop,
    onWorkflowJobGuard,
  );

  function startClassifyJob(scope?: "suspicious") {
    scopeRef.current = scope;
    setProgressOpen(true);
    job.start();
  }

  function handleProgressDone() {
    setProgressOpen(false);
    job.reset();
    void refresh();
  }

  async function handleAskAi(productId: string, note?: string) {
    setAiProductId(productId);
    try {
      const res = await fetch(
        `/api/import-cases/${caseId}/products/${productId}/ai-classify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            forceAi: true,
            ...(note !== undefined ? { note } : {}),
          }),
        },
      );
      const contentType = res.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? ((await res.json()) as {
            error?: string;
            hsCode?: string | null;
            needsReview?: boolean;
            reviewReason?: string | null;
            webSearchUsed?: boolean;
            proposedHsCode?: string | null;
            decisionRequired?: boolean;
            question?: string | null;
            options?: Array<{
              hsCode: string;
              reason?: string | null;
            }>;
          })
        : null;
      if (!res.ok) {
        throw new Error(
          data?.error ??
            (res.status === 404
              ? "Classification API not found — refresh and try again"
              : `AI classification failed (${res.status})`),
        );
      }
      if (!data) {
        throw new Error("Server returned an invalid response");
      }
      const updated = await refresh();
      if (data.decisionRequired) {
        const row = updated?.find((r) => r.product.id === productId);
        if (row) presentDecisionModal(row);
      } else if (data.hsCode && !isCatchAllHsCode(data.hsCode)) {
        toast.success(
          `AI suggested HS ${data.hsCode}${data.webSearchUsed ? " (web search)" : ""}${
            data.needsReview ? " - needs your review" : ""
          }`,
        );
      } else if (data.reviewReason) {
        toast.warning(data.reviewReason);
      } else if (data.hsCode?.startsWith("9999")) {
        toast.warning(
          `AI returned unclassified (9999) — try uploading the tariff book or set HS manually`,
        );
      } else {
        toast.warning(
          "AI could not classify this item — set HS manually or review the description",
        );
      }
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
    // an approved code that is being changed: grouping has to be run again
    const changingApproved =
      Boolean(hsCode) &&
      items.some((row) => row.product.id === productId && row.classification?.isFinal);
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
      if (changingApproved) {
        toast.success("Approved code changed", {
          description: "Grouping must be re-run after changing an approved code.",
          duration: 10000,
          ...(onGoToGrouping
            ? { action: { label: "Re-run grouping", onClick: onGoToGrouping } }
            : {}),
        });
      } else {
        toast.success("HS classification approved");
      }
      setOverrideId(null);
      if (decisionModal?.productId === productId) {
        setDecisionModal(null);
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Approval failed");
    } finally {
      setApprovingId(null);
    }
  }

  const verifiedProducts = items.filter((i) => i.product.humanVerified);
  const hasPriorClassification = verifiedProducts.some(
    (row) => row.classification != null || row.candidates.length > 0,
  );

  function handleClassify() {
    if (hasPriorClassification) {
      setRerunConfirmOpen(true);
      return;
    }
    startClassifyJob();
  }

  function confirmRerunClassify() {
    setRerunConfirmOpen(false);
    startClassifyJob();
  }

  // Products whose CURRENT code does not fit them (checked on the server).
  const suspiciousRows = verifiedProducts.filter(
    (row) => row.plausibility != null && needsRecheck(row.plausibility),
  );
  const suspiciousRechecked = suspiciousRows.filter(
    (row) => row.classification?.source !== "manual_override",
  );
  const suspiciousManualCount =
    suspiciousRows.length - suspiciousRechecked.length;
  const suspiciousApprovedCount = suspiciousRechecked.filter(
    (row) => row.classification?.isFinal,
  ).length;

  function handleRecheckSuspicious() {
    if (suspiciousRechecked.length === 0) return;
    if (
      suspiciousApprovedCount > 0 &&
      !window.confirm(
        `${suspiciousApprovedCount} of these codes are already approved. They will go back to review and need approval again (grouping must be run again afterwards). Continue?`,
      )
    ) {
      return;
    }
    startClassifyJob("suspicious");
  }

  const expertReviewRows = useMemo(
    () => verifiedProducts.filter(needsExpertReview),
    [verifiedProducts],
  );

  useEffect(() => {
    if (expertModalOpen && expertReviewRows.length === 0) {
      setExpertModalOpen(false);
    }
  }, [expertModalOpen, expertReviewRows.length]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return verifiedProducts;
    return verifiedProducts.filter((row) =>
      classificationSearchHaystack(row).includes(q),
    );
  }, [verifiedProducts, search]);

  const pagination = usePagination(filteredRows.length);
  const pageRows = filteredRows.slice(pagination.start, pagination.end);
  const withClassification = verifiedProducts.filter(
    (i) => i.classification && !isCatchAllHsCode(i.classification.hsCode),
  );
  const approvedCount = verifiedProducts.filter(
    (i) => i.classification?.isFinal,
  ).length;
  const unclassifiedRows = useMemo(
    () => verifiedProducts.filter(isUnclassified),
    [verifiedProducts],
  );
  const unclassifiedCount = unclassifiedRows.length;
  const pendingCount = verifiedProducts.filter(
    (i) => !i.classification?.isFinal,
  ).length;
  const bulk = useBulkReview({
    caseId,
    endpoint: "classifications/bulk-review",
    itemLabel: "classifications",
    onSuccess: async () => {
      await refresh();
    },
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
                onClick={() => {
                  scopeRef.current = undefined;
                  handleClassify();
                }}
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
            reference and get an OpenRouter suggestion with web search instead.
            Items with no confident tariff match are searched on the web and
            marked for review. Human approval is required before declaration
            grouping.
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
          {job.snapshot && !progressOpen ? (
            <ClassifyProgressBanner
              snapshot={job.snapshot}
              onShow={() => setProgressOpen(true)}
            />
          ) : null}
          {suspiciousRows.length > 0 ? (
            <div
              className="whitespace-normal rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800"
              role="alert"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {suspiciousRows.length} code(s) may not fit the product
                  </p>
                  <p className="mt-0.5">
                    The chapter or section of the code does not match what the
                    product description says, or it differs from the HS code on
                    the supplier invoice. Re-checking looks only at these
                    products; every other approved code stays as it is.
                    {suspiciousManualCount > 0
                      ? ` ${suspiciousManualCount} code(s) typed by hand are listed but never changed.`
                      : ""}
                  </p>
                </div>
                <DashButton
                  type="button"
                  variant="secondary"
                  onClick={handleRecheckSuspicious}
                  disabled={classifying || suspiciousRechecked.length === 0}
                  className="shrink-0"
                >
                  Re-check suspicious codes ({suspiciousRechecked.length})
                </DashButton>
              </div>
              <ul className="mt-2 space-y-0.5">
                {suspiciousRows.slice(0, 8).map((row) => (
                  <li key={row.product.id} className="min-w-0 truncate">
                    <span className="text-amber-700">
                      #{row.product.productSequence}
                    </span>{" "}
                    {row.product.productName ??
                      row.product.normalizedDescription ??
                      row.product.rawDescription ??
                      "Product"}{" "}
                    <span className="font-mono text-slate-900">
                      {row.classification?.hsCode}
                    </span>
                    {row.plausibility?.reasons[0]
                      ? ` - ${row.plausibility.reasons[0]}`
                      : ""}
                  </li>
                ))}
                {suspiciousRows.length > 8 ? (
                  <li className="text-amber-700">
                    and {suspiciousRows.length - 8} more
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
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
        ) : (
          <>
            <div className="border-b border-slate-100 px-5 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1 max-w-md">
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
                    placeholder="Search classifications — product, HS code, description, source…"
                    className={dashInputClass}
                    aria-label="Search classifications"
                  />
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <DashButton
                    type="button"
                    variant="secondary"
                    disabled={unclassifiedCount === 0}
                    onClick={() => setUnclassifiedModalOpen(true)}
                  >
                    Not classified
                    {unclassifiedCount > 0 ? ` (${unclassifiedCount})` : ""}
                  </DashButton>
                  <DashButton
                    type="button"
                    variant="secondary"
                    disabled={expertReviewRows.length === 0}
                    onClick={() => setExpertModalOpen(true)}
                  >
                    Expert review
                    {expertReviewRows.length > 0
                      ? ` (${expertReviewRows.length})`
                      : ""}
                  </DashButton>
                </div>
              </div>
              {search.trim() ? (
                <p className="mt-2 text-xs text-slate-500">
                  {filteredRows.length} of {verifiedProducts.length} product(s)
                  match
                </p>
              ) : null}
            </div>
            <DashTableBusy
              busy={classifying || bulk.loading || aiProductId != null}
              label={
                classifying
                  ? "Classifying products…"
                  : aiProductId
                    ? "Running AI classification…"
                    : "Updating classifications…"
              }
            >
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
                {pageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-sm text-slate-500"
                    >
                      No classifications match your search.
                    </td>
                  </tr>
                ) : null}
                {pageRows.map((row) => (
                    <ClassificationTableRow
                      key={row.product.id}
                      product={row.product}
                      candidates={row.candidates}
                      classification={row.classification}
                      tariffSnapshot={row.tariffSnapshot}
                      plausibility={row.plausibility}
                      approvingId={approvingId}
                      aiProductId={aiProductId}
                      overrideId={overrideId}
                      overrideHsCode={overrideHsCode}
                      onApprove={handleApprove}
                      onAskAi={handleAskAi}
                      onOpenDecision={() => presentDecisionModal(row)}
                      onStartOverride={(id, hsCode) => {
                        setOverrideId(id);
                        setOverrideHsCode(hsCode);
                      }}
                      onCancelOverride={() => setOverrideId(null)}
                      onOverrideHsCodeChange={setOverrideHsCode}
                    />
                  ))}
              </DashTbody>
            </DashTable>
            <Pagination
              bounds={pagination}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              itemLabel="products"
              note={
                pendingCount > 0
                  ? `Bulk review actions apply to all ${pendingCount} pending classification(s) (every page), not only this page.`
                  : undefined
              }
            />
            </DashTableBusy>
          </>
        )}
      </DashCard>

      <ClassifyProgressDialog
        open={progressOpen && job.snapshot !== null}
        snapshot={job.snapshot}
        onHide={() => setProgressOpen(false)}
        onDone={handleProgressDone}
        onStop={job.stop}
        onResume={job.resume}
        onRetryFailed={job.retryFailed}
      />

      <RerunWorkflowJobDialog
        job="classification"
        open={rerunConfirmOpen}
        onOpenChange={setRerunConfirmOpen}
        onConfirm={confirmRerunClassify}
        loading={classifying}
      />

      <ClassificationDecisionDialog
        open={decisionModal != null}
        onOpenChange={(open) => {
          if (!open) setDecisionModal(null);
        }}
        productSequence={decisionModal?.productSequence ?? 0}
        productLabel={decisionModal?.productLabel ?? ""}
        currentHsCode={decisionModal?.currentHsCode ?? null}
        review={decisionModal?.review ?? null}
        approving={
          decisionModal != null && approvingId === decisionModal.productId
        }
        onApproveOption={(candidateId) => {
          if (!decisionModal) return;
          void handleApprove(decisionModal.productId, candidateId);
        }}
      />

      <Dialog
        open={expertModalOpen}
        onOpenChange={(open) => {
          setExpertModalOpen(open);
          if (!open) setOverrideId(null);
        }}
      >
        <DialogContent className="!flex h-auto max-h-[min(90vh,52rem)] w-[min(96vw,56rem)] max-w-[56rem] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-slate-100 px-5 py-4 text-left">
            <DialogTitle>Expert review queue</DialogTitle>
            <DialogDescription>
              {expertReviewRows.length === 0
                ? "No products need expert review."
                : `${expertReviewRows.length} product(s) need a decision — approve, ask AI, or set HS without searching the full list.`}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 max-h-[calc(min(90vh,52rem)-6.5rem)] flex-1 overflow-y-auto overscroll-y-contain">
            {expertReviewRows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                You&apos;re caught up.
              </p>
            ) : (
              <DashTable tableClassName="table-fixed text-xs">
                <colgroup>
                  <col className="w-8" />
                  <col className="w-[24%]" />
                  <col className="w-[30%]" />
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
                  {expertReviewRows.map((row) => (
                      <ClassificationTableRow
                        key={row.product.id}
                        product={row.product}
                        candidates={row.candidates}
                        classification={row.classification}
                        tariffSnapshot={row.tariffSnapshot}
                        plausibility={row.plausibility}
                        approvingId={approvingId}
                        aiProductId={aiProductId}
                        overrideId={overrideId}
                        overrideHsCode={overrideHsCode}
                        onApprove={handleApprove}
                        onAskAi={handleAskAi}
                        onOpenDecision={() => presentDecisionModal(row)}
                        onStartOverride={(id, hsCode) => {
                          setOverrideId(id);
                          setOverrideHsCode(hsCode);
                        }}
                        onCancelOverride={() => setOverrideId(null)}
                        onOverrideHsCodeChange={setOverrideHsCode}
                      />
                    ))}
                </DashTbody>
              </DashTable>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={unclassifiedModalOpen}
        onOpenChange={(open) => {
          setUnclassifiedModalOpen(open);
          if (!open) setOverrideId(null);
        }}
      >
        <DialogContent className="!flex h-auto max-h-[min(90vh,52rem)] w-[min(96vw,56rem)] max-w-[56rem] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-slate-100 px-5 py-4 text-left">
            <DialogTitle>Not classified</DialogTitle>
            <DialogDescription>
              {unclassifiedCount === 0
                ? "Every verified product has an HS suggestion."
                : `${unclassifiedCount} product(s) have no tariff match yet (or are marked unclassified). Run classification, use Ask AI, or set HS manually.`}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 max-h-[calc(min(90vh,52rem)-6.5rem)] flex-1 overflow-y-auto overscroll-y-contain">
            {unclassifiedRows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                Nothing in this queue.
              </p>
            ) : (
              <DashTable tableClassName="table-fixed text-xs">
                <colgroup>
                  <col className="w-8" />
                  <col className="w-[24%]" />
                  <col className="w-[30%]" />
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
                  {unclassifiedRows.map((row) => (
                      <ClassificationTableRow
                        key={row.product.id}
                        product={row.product}
                        candidates={row.candidates}
                        classification={row.classification}
                        tariffSnapshot={row.tariffSnapshot}
                        plausibility={row.plausibility}
                        approvingId={approvingId}
                        aiProductId={aiProductId}
                        overrideId={overrideId}
                        overrideHsCode={overrideHsCode}
                        onApprove={handleApprove}
                        onAskAi={handleAskAi}
                        onOpenDecision={() => presentDecisionModal(row)}
                        onStartOverride={(id, hsCode) => {
                          setOverrideId(id);
                          setOverrideHsCode(hsCode);
                        }}
                        onCancelOverride={() => setOverrideId(null)}
                        onOverrideHsCodeChange={setOverrideHsCode}
                      />
                    ))}
                </DashTbody>
              </DashTable>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type ClassificationTableRowProps = {
  product: ProductClassificationBundle["product"];
  candidates: ProductClassificationBundle["candidates"];
  classification: ProductClassificationBundle["classification"];
  tariffSnapshot: ProductClassificationBundle["tariffSnapshot"];
  plausibility?: ProductClassificationBundle["plausibility"];
  approvingId: string | null;
  aiProductId: string | null;
  overrideId: string | null;
  overrideHsCode: string;
  onApprove: (productId: string, candidateId?: string, hsCode?: string) => void;
  onAskAi: (productId: string, note?: string) => void;
  onOpenDecision: () => void;
  onStartOverride: (productId: string, hsCode: string) => void;
  onCancelOverride: () => void;
  onOverrideHsCodeChange: (value: string) => void;
};

function ClassificationTableRow({
  product,
  candidates,
  classification,
  tariffSnapshot,
  plausibility,
  approvingId,
  aiProductId,
  overrideId,
  overrideHsCode,
  onApprove,
  onAskAi,
  onOpenDecision,
  onStartOverride,
  onCancelOverride,
  onOverrideHsCodeChange,
}: ClassificationTableRowProps) {
  const description =
    product.normalizedDescription ?? product.rawDescription ?? "—";
  const isOverriding = overrideId === product.id;
  const isApproving = approvingId === product.id;
  const isAskingAi = aiProductId === product.id;
  const review = buildClassificationReviewView(candidates, classification);

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
          <p
            className={`font-mono font-semibold truncate ${
              review.noCode ? "text-amber-700" : "text-indigo-700"
            }`}
            title={classification?.hsCode ?? undefined}
          >
            {review.noCode
              ? "No code suggested"
              : classification?.hsCode
                ? formatHsCode(classification.hsCode).display
                : "-"}
            {!review.noCode &&
            classification?.hsCode &&
            formatHsCode(classification.hsCode).incomplete ? (
              <span className="ml-1.5 font-sans text-[11px] font-medium text-amber-700">
                incomplete
              </span>
            ) : null}
          </p>
          <TruncatedText
            text={review.noCode ? "" : classification?.officialDescription ?? "—"}
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
          {plausibility && needsRecheck(plausibility) && !review.noCode ? (
            <p className="mt-1 whitespace-normal text-amber-700">
              {plausibility.reasons[0] ?? "This code may not fit the product."}
            </p>
          ) : null}
          <ReviewDetails
            productId={product.id}
            review={review}
            isApproving={isApproving}
            onApprove={onApprove}
            onOpenDecision={onOpenDecision}
          />
          {!classification ? (
            <p className="mt-1 whitespace-normal text-amber-700">
              No suggestion saved yet. Use Ask AI, optionally with a note
              about what the product is.
            </p>
          ) : null}
          {!classification?.isFinal ? (
            <NoteBox
              productId={product.id}
              savedNote={getReviewerNote(product.technicalSpecifications)}
              busy={isAskingAi || isApproving}
              defaultOpen={review.decisionRequired || !classification}
              onAskAi={onAskAi}
            />
          ) : null}
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-wrap items-center gap-1">
            {classification ? (
              <StatusBadge
                label={
                  review.webUsed && classification.source === "ai_suggestion"
                    ? "AI + web"
                    : sourceLabel(classification.source)
                }
                status={sourceBadgeStatus(classification.source)}
              />
            ) : null}
            {classification &&
            !review.noCode &&
            plausibility &&
            needsRecheck(plausibility) ? (
              <StatusBadge
                label={
                  plausibility.status === "implausible"
                    ? "Code doesn't fit"
                    : "Check code"
                }
                status="warning"
              />
            ) : null}
            {classification?.isFinal ? (
              <StatusBadge label="Approved" status="approved" />
            ) : product.status === "needs_expert_review" ||
              classification?.source === "expert_review" ? (
              <StatusBadge
                label={
                  review.decisionRequired
                    ? "Needs your decision"
                    : "Expert review"
                }
                status="warning"
              />
            ) : classification ? (
              <StatusBadge label="Pending" status="needs_review" />
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
                title="Skip the tariff reference and classify with OpenRouter AI and web search"
              >
                {isAskingAi ? "..." : "Ask AI"}
              </button>
              {classification && !review.noCode ? (
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
                  onStartOverride(
                    product.id,
                    review.noCode
                      ? (review.proposedHsCode ?? "")
                      : (classification?.hsCode ?? ""),
                  )
                }
                className="text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg px-2.5 py-1 whitespace-nowrap"
              >
                {classification && !review.noCode ? "Override" : "Set HS"}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => onStartOverride(product.id, classification?.hsCode ?? "")}
                disabled={isApproving}
                className="text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg px-2.5 py-1 whitespace-nowrap"
                title="Change the approved code. Grouping must be re-run afterwards."
              >
                Edit code
              </button>
            </div>
          )}
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
                {classification?.isFinal ? (
                  <p className="mt-1 whitespace-normal text-amber-700">
                    Grouping must be re-run after changing an approved code.
                  </p>
                ) : null}
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

function ReviewDetails({
  productId,
  review,
  isApproving,
  onApprove,
  onOpenDecision,
}: {
  productId: string;
  review: ClassificationReviewView;
  isApproving: boolean;
  onApprove: (productId: string, candidateId?: string, hsCode?: string) => void;
  onOpenDecision: () => void;
}) {
  const hasDetails =
    review.sources.length > 0 ||
    review.alternatives.length > 0 ||
    review.previousHsCode != null ||
    review.proposedHsCode != null ||
    review.rejectedCode != null ||
    review.confidenceNote != null ||
    review.userNoteUsed ||
    review.searchQueries.length > 0 ||
    review.webError != null;
  if (!review.reason && !hasDetails && !review.decisionRequired) return null;

  return (
    <div className="mt-1 space-y-1">
      {review.decisionRequired ? (
        <button
          type="button"
          onClick={onOpenDecision}
          className="mt-1.5 flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-left text-xs font-medium text-amber-900 hover:bg-amber-100/80"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            Review required
            {review.question ? (
              <span className="mt-0.5 block font-normal text-amber-800/90 line-clamp-2">
                {review.question}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 text-[#007bff]">Open</span>
        </button>
      ) : null}
      {review.reason ? (
        <p className="text-amber-700 whitespace-normal">{review.reason}</p>
      ) : null}
      {hasDetails ? (
        <details>
          <summary className="cursor-pointer select-none text-slate-500 hover:text-slate-700">
            Why this suggestion
          </summary>
          <div className="mt-1 max-h-48 space-y-1.5 overflow-y-auto overscroll-y-contain whitespace-normal rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-slate-600">
            {review.confidenceNote ? <p>{review.confidenceNote}</p> : null}
            {review.proposedHsCode ? (
              <p>
                Proposed by AI / web:{" "}
                <span className="font-mono text-slate-800">
                  {review.proposedHsCode}
                </span>{" "}
                (not an exact tariff-book code)
              </p>
            ) : null}
            {review.rejectedCode ? (
              <p>
                Dropped because it does not fit the product:{" "}
                <span className="font-mono text-slate-800">
                  {review.rejectedCode.hsCode}
                </span>
                {review.rejectedCode.reasons[0]
                  ? ` - ${review.rejectedCode.reasons[0]}`
                  : ""}
              </p>
            ) : null}
            {review.previousHsCode ? (
              <p>
                Previous suggestion:{" "}
                <span className="font-mono text-slate-800">
                  {review.previousHsCode}
                </span>
              </p>
            ) : null}
            {review.sources.length > 0 ? (
              <div>
                <p className="font-medium text-slate-700">Sources</p>
                <ul className="space-y-0.5">
                  {review.sources.slice(0, 5).map((source) => (
                    <li key={source.url} className="min-w-0 truncate">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-700 underline"
                        title={source.url}
                      >
                        {source.title}
                      </a>
                      {source.title !== source.host ? (
                        <span className="text-slate-400"> {source.host}</span>
                      ) : null}
                      {!source.fromSearch ? (
                        <span className="text-slate-400">
                          {" "}
                          (named by the AI, not confirmed by search)
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {review.userNoteUsed ? (
              <p>Your note for the AI was used for this suggestion.</p>
            ) : null}
            {review.searchQueries.length > 0 ? (
              <p>Searches tried: {review.searchQueries.join(" | ")}</p>
            ) : null}
            {review.webError ? (
              <p className="text-slate-500">
                Web search was not available: {review.webError}
              </p>
            ) : null}
            {review.alternatives.length > 0 ? (
              <div>
                <p className="font-medium text-slate-700">Other possible codes</p>
                <ul className="space-y-1">
                  {review.alternatives.map((alt) => (
                    <li key={alt.candidateId} className="flex items-start gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="font-mono text-slate-800">
                          {alt.hsCode}
                        </span>
                        {alt.officialDescription
                          ? ` - ${alt.officialDescription}`
                          : ""}
                        {alt.reason ? (
                          <span className="block text-slate-400">
                            {alt.reason}
                          </span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => onApprove(productId, alt.candidateId)}
                        disabled={isApproving}
                        className="shrink-0 rounded-lg bg-white px-2 py-0.5 font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                        title="Approve this code instead"
                      >
                        Approve this
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function NoteBox({
  productId,
  savedNote,
  busy,
  defaultOpen,
  onAskAi,
}: {
  productId: string;
  savedNote: string;
  busy: boolean;
  defaultOpen: boolean;
  onAskAi: (productId: string, note?: string) => void;
}) {
  const [text, setText] = useState(savedNote);
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    setText(savedNote);
  }, [savedNote]);
  const fieldId = `ai-note-${productId}`;

  return (
    <details
      className="mt-2"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer select-none text-slate-500 hover:text-slate-700">
        {savedNote ? "Your note for the AI (saved)" : "Add a note for the AI"}
      </summary>
      <div className="mt-1 space-y-1.5 whitespace-normal">
        <label htmlFor={fieldId} className="block text-slate-500">
          What is this product? Anything the AI should know.
        </label>
        <textarea
          id={fieldId}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          rows={2}
          maxLength={500}
          placeholder="e.g. dried fish snack"
          aria-describedby={`${fieldId}-hint`}
          className={`${dashInputClass} pl-3 w-full text-xs`}
        />
        <p id={`${fieldId}-hint`} className="text-slate-400">
          {text.length}/500. Saved with this product and used every time it is
          classified again.
        </p>
        <button
          type="button"
          onClick={() => onAskAi(productId, text)}
          disabled={busy}
          className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg px-2.5 py-1 whitespace-nowrap"
        >
          {busy ? "Asking..." : "Ask AI again"}
        </button>
      </div>
    </details>
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
