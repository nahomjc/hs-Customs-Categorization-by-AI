"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

  async function refreshChecks() {
    const res = await fetch(`/api/import-cases/${caseId}/checks`);
    if (!res.ok) return;
    const data = (await res.json()) as { checks: DocumentCheckRow[] };
    setChecks(data.checks);
    router.refresh();
  }

  const openChecks = checks.filter((c) => c.status === "open");
  const pendingCount = openChecks.length;
  const bulk = useBulkReview({
    caseId,
    endpoint: "checks/bulk-review",
    itemLabel: "checks",
    onSuccess: refreshChecks,
  });

  const errors = checks.filter((c) => c.severity === "error");
  const warnings = checks.filter((c) => c.severity === "warning");
  const infos = checks.filter((c) => c.severity === "info");

  if (checks.length === 0) {
    return (
      <DashCard>
        <div className="p-8 text-center text-slate-500">
          <p className="font-medium text-slate-700">No checks yet</p>
          <p className="mt-2 text-sm">
            Upload and extract invoice and packing list documents to run
            validation checks.
          </p>
        </div>
      </DashCard>
    );
  }

  return (
    <div className="space-y-6">
      {pendingCount > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Review validation checks before continuing to harmonization.
          </p>
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
        </div>
      ) : null}

      {errors.length > 0 ? (
        <CheckSection title="Errors" checks={errors} />
      ) : null}
      {warnings.length > 0 ? (
        <CheckSection title="Warnings" checks={warnings} />
      ) : null}
      {infos.length > 0 ? (
        <CheckSection title="Information" checks={infos} />
      ) : null}
    </div>
  );
}

function CheckSection({
  title,
  checks,
}: {
  title: string;
  checks: DocumentCheckRow[];
}) {
  return (
    <DashCard>
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-bold text-slate-900">{title}</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {checks.map((check) => (
          <div key={check.id} className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <StatusBadge label={check.severity} status={check.severity} />
              <StatusBadge label={check.status} status={check.status} />
            </div>
            <p className="font-medium text-slate-900">{check.title}</p>
            <p className="text-sm text-slate-600 mt-1">{check.message}</p>
          </div>
        ))}
      </div>
    </DashCard>
  );
}
