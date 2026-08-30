"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { BulkReviewAction } from "@/components/dashboard/import-case/BulkReviewActions";

type UseBulkReviewOptions = {
  caseId: string;
  endpoint: string;
  itemLabel: string;
  onSuccess?: () => void | Promise<void>;
};

const ACTION_MESSAGES: Record<
  BulkReviewAction,
  { success: string; title: string; description: string; confirm: string }
> = {
  approve: {
    success: "All items approved",
    title: "Approve all items?",
    description:
      "This will approve every pending item using the current suggested values.",
    confirm: "Approve all",
  },
  override: {
    success: "All items overridden",
    title: "Override all items?",
    description:
      "This will apply your override to every pending item in this step.",
    confirm: "Override all",
  },
  reject: {
    success: "All items rejected",
    title: "Reject all items?",
    description:
      "This will reject every pending item and may send the case back for correction.",
    confirm: "Reject all",
  },
};

export function useBulkReview({
  caseId,
  endpoint,
  itemLabel,
  onSuccess,
}: UseBulkReviewOptions) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [modalAction, setModalAction] = useState<BulkReviewAction | null>(null);

  async function executeBulkReview(
    action: BulkReviewAction,
    payload: { reason?: string; overrideValue?: string },
  ) {
    setLoading(true);
    try {
      const res = await fetch(`/api/import-cases/${caseId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: payload.reason ?? null,
          overrideHsCode: payload.overrideValue ?? null,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        affectedCount?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "Bulk action failed");

      toast.success(
        `${ACTION_MESSAGES[action].success} (${data.affectedCount ?? 0} ${itemLabel})`,
      );
      setModalAction(null);
      await onSuccess?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk action failed");
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    modalAction,
    openModal: setModalAction,
    closeModal: () => setModalAction(null),
    executeBulkReview,
    actionMessages: ACTION_MESSAGES,
  };
}
