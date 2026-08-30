"use client";

import { useState } from "react";
import { DashButton } from "@/components/dashboard/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dashInputClass } from "@/components/dashboard/ui";

export type BulkReviewAction = "approve" | "override" | "reject";

type ConfirmBulkActionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: BulkReviewAction | null;
  title: string;
  description: string;
  confirmLabel: string;
  pendingCount: number;
  itemLabel: string;
  showReasonField?: boolean;
  showOverrideField?: boolean;
  overrideLabel?: string;
  overridePlaceholder?: string;
  requireOverrideValue?: boolean;
  loading?: boolean;
  onConfirm: (payload: {
    reason?: string;
    overrideValue?: string;
  }) => void | Promise<void>;
};

const ACTION_STYLES: Record<
  BulkReviewAction,
  { button: string; confirm: "primary" | "secondary" }
> = {
  approve: {
    button: "bg-indigo-600 hover:bg-indigo-700 text-white",
    confirm: "primary",
  },
  override: {
    button: "bg-orange-500 hover:bg-orange-600 text-white",
    confirm: "primary",
  },
  reject: {
    button: "bg-white border border-red-200 text-red-700 hover:bg-red-50",
    confirm: "secondary",
  },
};

export function BulkReviewActionButtons({
  pendingCount,
  itemLabel,
  showOverride = true,
  onActionClick,
  loading = false,
}: {
  pendingCount: number;
  itemLabel: string;
  showOverride?: boolean;
  onActionClick: (action: BulkReviewAction) => void;
  loading?: boolean;
}) {
  if (pendingCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500 mr-1">
        {pendingCount} {itemLabel} pending review
      </span>
      <button
        type="button"
        disabled={loading}
        onClick={() => onActionClick("approve")}
        className={`text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50 ${ACTION_STYLES.approve.button}`}
      >
        Approve all
      </button>
      {showOverride ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => onActionClick("override")}
          className={`text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50 ${ACTION_STYLES.override.button}`}
        >
          Override all
        </button>
      ) : null}
      <button
        type="button"
        disabled={loading}
        onClick={() => onActionClick("reject")}
        className={`text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50 ${ACTION_STYLES.reject.button}`}
      >
        Reject all
      </button>
    </div>
  );
}

export function ConfirmBulkActionModal({
  open,
  onOpenChange,
  action,
  title,
  description,
  confirmLabel,
  pendingCount,
  itemLabel,
  showReasonField = true,
  showOverrideField = false,
  overrideLabel = "Override value",
  overridePlaceholder = "",
  requireOverrideValue = false,
  loading = false,
  onConfirm,
}: ConfirmBulkActionModalProps) {
  const [reason, setReason] = useState("");
  const [overrideValue, setOverrideValue] = useState("");

  function handleOpenChange(next: boolean) {
    if (!next) {
      setReason("");
      setOverrideValue("");
    }
    onOpenChange(next);
  }

  async function handleConfirm() {
    await onConfirm({
      reason: reason.trim() || undefined,
      overrideValue: overrideValue.trim() || undefined,
    });
    setReason("");
    setOverrideValue("");
  }

  const canConfirm =
    !loading &&
    (!requireOverrideValue || overrideValue.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showClose={!loading}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
            <span className="block mt-2 font-medium text-slate-800">
              This will affect {pendingCount} {itemLabel}.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {showOverrideField ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">
                {overrideLabel}
              </span>
              <input
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
                placeholder={overridePlaceholder}
                className={`${dashInputClass} pl-3`}
              />
            </label>
          ) : null}
          {showReasonField ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">
                Note (optional)
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Add a reviewer note for the audit log…"
                className={`${dashInputClass} pl-3`}
              />
            </label>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DashButton
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </DashButton>
          <DashButton
            variant={action ? ACTION_STYLES[action].confirm : "primary"}
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={
              action === "reject"
                ? "!bg-red-600 !text-white hover:!bg-red-700"
                : action === "override"
                  ? "!bg-orange-500 hover:!bg-orange-600"
                  : undefined
            }
          >
            {loading ? "Processing…" : confirmLabel}
          </DashButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useBulkReviewModal() {
  const [modalAction, setModalAction] = useState<BulkReviewAction | null>(null);

  return {
    modalAction,
    openModal: (action: BulkReviewAction) => setModalAction(action),
    closeModal: () => setModalAction(null),
  };
}

type BulkReviewToolbarProps = {
  pendingCount: number;
  itemLabel: string;
  showOverride?: boolean;
  loading: boolean;
  modalAction: BulkReviewAction | null;
  actionMessages: Record<
    BulkReviewAction,
    { success: string; title: string; description: string; confirm: string }
  >;
  onActionClick: (action: BulkReviewAction) => void;
  onModalOpenChange: (open: boolean) => void;
  onConfirm: (payload: {
    reason?: string;
    overrideValue?: string;
  }) => void | Promise<void>;
  overrideField?: {
    label: string;
    placeholder: string;
    required?: boolean;
  };
};

export function BulkReviewToolbar({
  pendingCount,
  itemLabel,
  showOverride = true,
  loading,
  modalAction,
  actionMessages,
  onActionClick,
  onModalOpenChange,
  onConfirm,
  overrideField,
}: BulkReviewToolbarProps) {
  const action = modalAction;

  return (
    <>
      <BulkReviewActionButtons
        pendingCount={pendingCount}
        itemLabel={itemLabel}
        showOverride={showOverride}
        onActionClick={onActionClick}
        loading={loading}
      />
      {action ? (
        <ConfirmBulkActionModal
          open={Boolean(action)}
          onOpenChange={onModalOpenChange}
          action={action}
          title={actionMessages[action].title}
          description={actionMessages[action].description}
          confirmLabel={actionMessages[action].confirm}
          pendingCount={pendingCount}
          itemLabel={itemLabel}
          loading={loading}
          showOverrideField={action === "override" && Boolean(overrideField)}
          overrideLabel={overrideField?.label}
          overridePlaceholder={overrideField?.placeholder}
          requireOverrideValue={overrideField?.required}
          onConfirm={onConfirm}
        />
      ) : null}
    </>
  );
}
