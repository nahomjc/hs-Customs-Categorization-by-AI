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
import type { InvoiceLineRow } from "@/db/schema/invoiceLines";
import { useBulkReview } from "@/lib/import-cases/use-bulk-review";

type InvoiceLineWithDoc = {
  line: InvoiceLineRow;
  documentName: string | null;
  documentType: string | null;
};

type InvoiceLinesTabProps = {
  caseId: string;
  invoiceDocuments: ImportCaseDocumentRow[];
  initialLines: InvoiceLineWithDoc[];
};

export function InvoiceLinesTab({
  caseId,
  invoiceDocuments,
  initialLines,
}: InvoiceLinesTabProps) {
  const router = useRouter();
  const [lines, setLines] = useState(initialLines);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    documentId: invoiceDocuments[0]?.id ?? "",
    supplierDescription: "",
    quantity: "",
    unitOfMeasure: "pcs",
    unitPrice: "",
    lineTotalAmount: "",
    currencyCode: "USD",
    supplierSku: "",
    brand: "",
    modelNumber: "",
  });

  async function refreshLines() {
    const res = await fetch(`/api/import-cases/${caseId}/invoice-lines`);
    if (!res.ok) return;
    const data = (await res.json()) as { lines: InvoiceLineWithDoc[] };
    setLines(data.lines);
    router.refresh();
  }

  const pendingCount = lines.filter(({ line }) => !line.isReviewed).length;
  const bulk = useBulkReview({
    caseId,
    endpoint: "invoice-lines/bulk-review",
    itemLabel: "invoice lines",
    onSuccess: refreshLines,
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.documentId) {
      toast.error("Upload a commercial invoice document first");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/import-cases/${caseId}/invoice-lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to add line");
      toast.success("Invoice line added");
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
          title="Invoice lines"
          action={
            <div className="flex flex-col items-end gap-2">
              <BulkReviewToolbar
                pendingCount={pendingCount}
                itemLabel="invoice lines"
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
                disabled={invoiceDocuments.length === 0}
              >
                {showForm ? "Cancel" : "Add line manually"}
              </DashButton>
            </div>
          }
        />
        {invoiceDocuments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            Upload a commercial invoice in the Documents tab first.
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
              {invoiceDocuments.map((doc) => (
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
                placeholder="Unit price"
                value={form.unitPrice}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unitPrice: e.target.value }))
                }
                className={dashInputClass}
              />
              <input
                placeholder="Currency"
                value={form.currencyCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currencyCode: e.target.value }))
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
              <DashTh>Unit</DashTh>
              <DashTh>Price</DashTh>
              <DashTh>Source</DashTh>
              <DashTh>Reviewed</DashTh>
            </DashTableHeaderRow>
          </DashTableHead>
          <DashTbody>
            {lines.length === 0 ? (
              <DashTableEmpty colSpan={7}>No invoice lines yet.</DashTableEmpty>
            ) : (
              lines.map(({ line, documentName }) => (
                <DashTr key={line.id}>
                  <DashTd>{line.lineNumber}</DashTd>
                  <DashTd>{line.supplierDescription}</DashTd>
                  <DashTd>{line.quantity}</DashTd>
                  <DashTd>{line.unitOfMeasure}</DashTd>
                  <DashTd>
                    {line.unitPrice
                      ? `${line.unitPrice} ${line.currencyCode}`
                      : "—"}
                  </DashTd>
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
