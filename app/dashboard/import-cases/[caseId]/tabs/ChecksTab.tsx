"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BulkReviewToolbar } from "@/components/dashboard/import-case/BulkReviewActions";
import { DashCard, StatusBadge } from "@/components/dashboard/ui";
import type { DocumentCheckRow } from "@/db/schema/documentChecks";
import { useBulkReview } from "@/lib/import-cases/use-bulk-review";

type ChecksTabProps = {
  caseId: string;
  checks: DocumentCheckRow[];
};

export function ChecksTab({ caseId, checks: initialChecks }: ChecksTabProps) {
  const router = useRouter();
  const [checks, setChecks] = useState(initialChecks);
  const [revalidating, setRevalidating] = useState(false);

  const refreshChecks = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setRevalidating(true);
      try {
        const res = await fetch(`/api/import-cases/${caseId}/checks`);
        if (!res.ok) return;
        const data = (await res.json()) as { checks: DocumentCheckRow[] };
        setChecks(data.checks);
        router.refresh();
      } finally {
        if (!options?.silent) setRevalidating(false);
      }
    },
    [caseId, router],
  );

  // Recompute against current invoice/packing lines whenever this step opens.
  useEffect(() => {
    void refreshChecks({ silent: true });
  }, [refreshChecks]);

  useEffect(() => {
    setChecks(initialChecks);
  }, [initialChecks]);

  const openChecks = checks.filter((c) => c.status === "open");
  const pendingCount = openChecks.length;
  const bulk = useBulkReview({
    caseId,
    endpoint: "checks/bulk-review",
    itemLabel: "checks",
    onSuccess: () => {
      void refreshChecks();
    },
  });

  const errors = openChecks.filter((c) => c.severity === "error");
  const warnings = openChecks.filter((c) => c.severity === "warning");
  const infos = openChecks.filter((c) => c.severity === "info");
  const closed = checks.filter((c) => c.status !== "open");

  if (revalidating && checks.length === 0) {
    return (
      <DashCard>
        <div className="p-8 text-center text-slate-500">
          <p className="font-medium text-slate-700">Re-validating…</p>
          <p className="mt-2 text-sm">
            Checking invoice and packing list lines against the latest data.
          </p>
        </div>
      </DashCard>
    );
  }

  if (checks.length === 0) {
    return (
      <DashCard>
        <div className="p-8 text-center text-slate-500">
          <p className="font-medium text-slate-700">No open issues</p>
          <p className="mt-2 text-sm">
            Invoice and packing list quantities currently match. You can
            continue to harmonized products.
          </p>
        </div>
      </DashCard>
    );
  }

  if (openChecks.length === 0) {
    return (
      <div className="space-y-6">
        <DashCard>
          <div className="p-8 text-center">
            <p className="font-medium text-emerald-800">All checks clear</p>
            <p className="mt-2 text-sm text-slate-600">
              Previous issues were fixed or resolved. Continue to the next step.
            </p>
            <button
              type="button"
              onClick={() => void refreshChecks()}
              disabled={revalidating}
              className="mt-4 text-sm font-medium text-[#2563eb] hover:underline disabled:opacity-50"
            >
              {revalidating ? "Re-validating…" : "Re-validate now"}
            </button>
          </div>
        </DashCard>
        {closed.length > 0 ? (
          <CheckSection title="Resolved / ignored" checks={closed} muted />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-600">
            Review validation checks before continuing to harmonization.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Checks refresh automatically when you edit invoice or packing list
            lines.
            {revalidating ? " Updating…" : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshChecks()}
            disabled={revalidating}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {revalidating ? "Re-validating…" : "Re-validate"}
          </button>
          {pendingCount > 0 ? (
            <BulkReviewToolbar
              pendingCount={pendingCount}
              itemLabel="checks"
              loading={bulk.loading}
              modalAction={bulk.modalAction}
              actionMessages={{
                ...bulk.actionMessages,
                approve: {
                  ...bulk.actionMessages.approve,
                  title: "Resolve all checks?",
                  description:
                    "Mark every open check as resolved. Use this when issues are acceptable or corrected.",
                  confirm: "Resolve all",
                },
                reject: {
                  ...bulk.actionMessages.reject,
                  title: "Ignore all checks?",
                  description:
                    "Mark every open check as ignored. The case may still need manual follow-up.",
                  confirm: "Ignore all",
                },
              }}
              onActionClick={bulk.openModal}
              onModalOpenChange={(open) => !open && bulk.closeModal()}
              onConfirm={(payload) =>
                bulk.modalAction
                  ? bulk.executeBulkReview(bulk.modalAction, payload)
                  : undefined
              }
            />
          ) : null}
        </div>
      </div>

      {errors.length > 0 ? (
        <CheckSection title="Errors" checks={errors} />
      ) : null}
      {warnings.length > 0 ? (
        <CheckSection title="Warnings" checks={warnings} />
      ) : null}
      {infos.length > 0 ? (
        <CheckSection title="Information" checks={infos} />
      ) : null}
      {closed.length > 0 ? (
        <CheckSection title="Resolved / ignored" checks={closed} muted />
      ) : null}
    </div>
  );
}

function CheckSection({
  title,
  checks,
  muted = false,
}: {
  title: string;
  checks: DocumentCheckRow[];
  muted?: boolean;
}) {
  return (
    <DashCard className={muted ? "opacity-80" : undefined}>
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-bold text-slate-900">{title}</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {checks.map((check) => (
          <div key={check.id} className="px-5 py-4">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <StatusBadge label={check.severity} status={check.severity} />
              <StatusBadge label={check.status} status={check.status} />
            </div>
            <p className="font-medium text-slate-900">{check.title}</p>
            <p className="mt-1 text-sm text-slate-600">{check.message}</p>
          </div>
        ))}
      </div>
    </DashCard>
  );
}
