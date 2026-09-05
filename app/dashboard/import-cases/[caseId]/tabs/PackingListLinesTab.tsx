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
  DashTableEmpty,
  DashTableHead,
  DashTableHeaderRow,
  DashTbody,
  DashTd,
  DashTh,
  DashTr,
  StatusBadge,
  dashInputClass,
  dashSelectClass,
} from "@/components/dashboard/ui";
import type { ImportCaseDocumentRow } from "@/db/schema/importCaseDocuments";
import type { PackingListLineRow } from "@/db/schema/packingListLines";
import { useBulkReview } from "@/lib/import-cases/use-bulk-review";

type PackingLineWithDoc = {
  line: PackingListLineRow;
  documentName: string | null;
  documentType: string | null;
};

type PackingListLinesTabProps = {
  caseId: string;
  packingDocuments: ImportCaseDocumentRow[];
  initialLines: PackingLineWithDoc[];
};

export function PackingListLinesTab({
  caseId,
  packingDocuments,
  initialLines,
}: PackingListLinesTabProps) {
  const router = useRouter();
  const [lines, setLines] = useState(initialLines);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    documentId: packingDocuments[0]?.id ?? "",
    supplierDescription: "",
    quantity: "",
    unitOfMeasure: "pcs",
    numberOfPackages: "",
    packageType: "",
    netWeightKg: "",
    grossWeightKg: "",
  });

  async function refreshLines() {
    const res = await fetch(`/api/import-cases/${caseId}/packing-list-lines`);
    if (!res.ok) return;
    const data = (await res.json()) as { lines: PackingLineWithDoc[] };
    setLines(data.lines);
    router.refresh();
  }

  const pendingCount = lines.filter(({ line }) => !line.isReviewed).length;
  const bulk = useBulkReview({
    caseId,
    endpoint: "packing-list-lines/bulk-review",
    itemLabel: "packing lines",
    onSuccess: refreshLines,
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.documentId) {
      toast.error("Upload a packing list document first");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/import-cases/${caseId}/packing-list-lines`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to add line");
      toast.success("Packing list line added");
      setShowForm(false);
      await refreshLines();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add line");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <DashCard>
        <DashCardHeader
          title="Packing list lines"
          action={
            <div className="flex flex-col items-end gap-2">
              <BulkReviewToolbar
                pendingCount={pendingCount}
                itemLabel="packing lines"
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
                variant="secondary"
                onClick={() => setShowForm((v) => !v)}
                disabled={packingDocuments.length === 0}
              >
                {showForm ? "Cancel" : "Add line manually"}
              </DashButton>
            </div>
          }
        />
        {packingDocuments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            Upload a packing list in the Documents tab first.
          </p>
        ) : showForm ? (
          <form onSubmit={handleCreate} className="p-5 space-y-4 border-t border-slate-100">
            <select
              value={form.documentId}
              onChange={(e) =>
                setForm((f) => ({ ...f, documentId: e.target.value }))
              }
              className={dashSelectClass}
            >
              {packingDocuments.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.originalFileName}
                </option>
              ))}
            </select>
            <input
              required
              placeholder="Supplier description"
              value={form.supplierDescription}
              onChange={(e) =>
                setForm((f) => ({ ...f, supplierDescription: e.target.value }))
              }
              className={dashInputClass}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <input
                required
                placeholder="Quantity"
                value={form.quantity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quantity: e.target.value }))
                }
                className={dashInputClass}
              />
              <input
                required
                placeholder="Unit"
                value={form.unitOfMeasure}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unitOfMeasure: e.target.value }))
                }
                className={dashInputClass}
              />
              <input
                placeholder="Packages"
                value={form.numberOfPackages}
                onChange={(e) =>
                  setForm((f) => ({ ...f, numberOfPackages: e.target.value }))
                }
                className={dashInputClass}
              />
              <input
                placeholder="Package type"
                value={form.packageType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, packageType: e.target.value }))
                }
                className={dashInputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Net weight (kg)"
                value={form.netWeightKg}
                onChange={(e) =>
                  setForm((f) => ({ ...f, netWeightKg: e.target.value }))
                }
                className={dashInputClass}
              />
              <input
                placeholder="Gross weight (kg)"
                value={form.grossWeightKg}
                onChange={(e) =>
                  setForm((f) => ({ ...f, grossWeightKg: e.target.value }))
                }
                className={dashInputClass}
              />
            </div>
            <DashButton type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save line"}
            </DashButton>
          </form>
        ) : null}
      </DashCard>

      <DashCard>
        <DashTable>
          <DashTableHead>
            <DashTableHeaderRow>
              <DashTh>#</DashTh>
              <DashTh>Description</DashTh>
              <DashTh>Qty</DashTh>
              <DashTh>Packages</DashTh>
              <DashTh>Net wt</DashTh>
              <DashTh>Gross wt</DashTh>
              <DashTh>Source</DashTh>
              <DashTh>Reviewed</DashTh>
            </DashTableHeaderRow>
          </DashTableHead>
          <DashTbody>
            {lines.length === 0 ? (
              <DashTableEmpty colSpan={8}>
                No packing list lines yet.
              </DashTableEmpty>
            ) : (
              lines.map(({ line, documentName }) => (
                <DashTr key={line.id}>
                  <DashTd>{line.lineNumber}</DashTd>
                  <DashTd>{line.supplierDescription}</DashTd>
                  <DashTd>
                    {line.quantity} {line.unitOfMeasure}
                  </DashTd>
                  <DashTd>
                    {line.numberOfPackages ?? "—"}
                    {line.packageType ? ` (${line.packageType})` : ""}
                  </DashTd>
                  <DashTd>{line.netWeightKg ?? "—"}</DashTd>
                  <DashTd>{line.grossWeightKg ?? "—"}</DashTd>
                  <DashTd muted className="text-xs">
                    {documentName ?? "—"}
                  </DashTd>
                  <DashTd>
                    <StatusBadge
                      label={line.isReviewed ? "Reviewed" : "Pending"}
                      status={line.isReviewed ? "completed" : "uploaded"}
                    />
                  </DashTd>
                </DashTr>
              ))
            )}
          </DashTbody>
        </DashTable>
      </DashCard>
    </div>
  );
}
