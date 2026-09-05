"use client";

import { useId, isValidElement, cloneElement } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ClientSearchSelect,
  type ClientOption,
} from "@/components/dashboard/ClientSearchSelect";
import { CountrySearchSelect } from "@/components/dashboard/CountrySearchSelect";
import {
  DashButton,
  DashCard,
  DashCardHeader,
  StatusBadge,
  dashInputClass,
  dashSelectClass,
} from "@/components/dashboard/ui";
import {
  IMPORT_CASE_STATUS_LABELS,
  type ImportCaseStatus,
} from "@/lib/import-cases/constants";
import {
  TRACKING_STATUSES,
  TRACKING_STATUS_LABELS,
  type TrackingStatus,
} from "@/lib/tracking/constants";
import type { ImportCaseRow } from "@/db/schema/importCases";

type AgentOption = {
  id: string;
  fullName: string | null;
  email: string;
};

type OverviewTabProps = {
  importCase: ImportCaseRow;
  agents: AgentOption[];
  client?: ClientOption | null;
};

type FormState = {
  importerName: string;
  importerTinNumber: string;
  supplierName: string;
  countryOfExportCode: string;
  countryOfOriginCode: string;
  shipmentReference: string;
  billOfLadingNumber: string;
  airwayBillNumber: string;
  importProcedureCode: string;
  incoterm: string;
  invoiceCurrencyCode: string;
  assignedAgentId: string;
  clientUserId: string;
  notes: string;
};

function toFormState(importCase: ImportCaseRow): FormState {
  return {
    importerName: importCase.importerName ?? "",
    importerTinNumber: importCase.importerTinNumber ?? "",
    supplierName: importCase.supplierName ?? "",
    countryOfExportCode: importCase.countryOfExportCode ?? "",
    countryOfOriginCode: importCase.countryOfOriginCode ?? "",
    shipmentReference: importCase.shipmentReference ?? "",
    billOfLadingNumber: importCase.billOfLadingNumber ?? "",
    airwayBillNumber: importCase.airwayBillNumber ?? "",
    importProcedureCode: importCase.importProcedureCode ?? "",
    incoterm: importCase.incoterm ?? "",
    invoiceCurrencyCode: importCase.invoiceCurrencyCode ?? "",
    assignedAgentId: importCase.assignedAgentId ?? "",
    clientUserId: importCase.clientUserId ?? "",
    notes: importCase.notes ?? "",
  };
}

export function OverviewTab({
  importCase,
  agents,
  client = null,
}: OverviewTabProps) {
  const router = useRouter();
  const status = (importCase.status as ImportCaseStatus) ?? "draft";
  const [form, setForm] = useState<FormState>(() => toFormState(importCase));
  const [clientLabel, setClientLabel] = useState(() =>
    client
      ? `${client.fullName ?? client.email}${client.phone ? ` · ${client.phone}` : ""}`
      : "",
  );
  const [loading, setLoading] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>(
    (importCase.trackingStatus as TrackingStatus) || "received",
  );
  const [trackingNote, setTrackingNote] = useState(
    importCase.trackingNote ?? "",
  );

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  }

  async function handleSave() {
    if (!form.importerName.trim()) {
      toast.error("Importer name is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/import-cases/${importCase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importerName: form.importerName.trim(),
          importerTinNumber: form.importerTinNumber.trim() || null,
          supplierName: form.supplierName.trim() || null,
          countryOfExportCode: form.countryOfExportCode || null,
          countryOfOriginCode: form.countryOfOriginCode || null,
          shipmentReference: form.shipmentReference.trim() || null,
          billOfLadingNumber: form.billOfLadingNumber.trim() || null,
          airwayBillNumber: form.airwayBillNumber.trim() || null,
          importProcedureCode: form.importProcedureCode.trim() || null,
          incoterm: form.incoterm.trim() || null,
          invoiceCurrencyCode: form.invoiceCurrencyCode.trim() || null,
          assignedAgentId: form.assignedAgentId || null,
          clientUserId: form.clientUserId || null,
          notes: form.notes.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save case details");

      toast.success("Case details saved");
      setDirty(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save case details",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleTrackingUpdate() {
    setTrackingLoading(true);
    try {
      const res = await fetch(`/api/import-cases/${importCase.id}/tracking`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingStatus,
          trackingNote: trackingNote.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to update tracking");
      toast.success("Client tracking updated — notifications sent");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update tracking",
      );
    } finally {
      setTrackingLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <DashCard>
        <DashCardHeader title="Client shipment tracking" />
        <div className="px-5 py-5 space-y-4">
          <p className="text-xs text-slate-500">
            Updates here notify the linked client on their dashboard, Telegram,
            and SMS (when configured).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tracking status" htmlFor="tracking-status">
              <select
                id="tracking-status"
                value={trackingStatus}
                onChange={(e) =>
                  setTrackingStatus(e.target.value as TrackingStatus)
                }
                className={`w-full ${dashSelectClass}`}
              >
                {TRACKING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TRACKING_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Note for client">
              <input
                value={trackingNote}
                onChange={(e) => setTrackingNote(e.target.value)}
                placeholder="Optional note"
                className={dashInputClass}
              />
            </Field>
          </div>
          <DashButton
            type="button"
            disabled={trackingLoading}
            onClick={() => void handleTrackingUpdate()}
          >
            {trackingLoading ? "Updating…" : "Update tracking & notify"}
          </DashButton>
        </div>
      </DashCard>

      <DashCard>
        <DashCardHeader
          title="Case details"
          action={
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs font-mono text-slate-500">
                {importCase.caseNumber}
              </span>
              <StatusBadge
                label={IMPORT_CASE_STATUS_LABELS[status]}
                status={status}
              />
            </div>
          }
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
          className="divide-y divide-slate-100"
        >
          <FormSection
            title="Client"
            description="The client account that receives shipment updates."
          >
            <Field label="Client" htmlFor="client-user">
              <ClientSearchSelect
                id="client-user"
                value={form.clientUserId}
                selectedLabel={clientLabel || null}
                onChange={(clientId, next) => {
                  updateField("clientUserId", clientId);
                  setClientLabel(
                    next
                      ? `${next.fullName ?? next.email}${
                          next.phone ? ` · ${next.phone}` : ""
                        }`
                      : "",
                  );
                }}
              />
            </Field>
          </FormSection>

          <FormSection
            title="Parties"
            description="Importer and supplier information for this shipment."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Importer name *">
                <input
                  required
                  value={form.importerName}
                  onChange={(e) => updateField("importerName", e.target.value)}
                  className={dashInputClass}
                />
              </Field>
              <Field label="Importer TIN">
                <input
                  value={form.importerTinNumber}
                  onChange={(e) =>
                    updateField("importerTinNumber", e.target.value)
                  }
                  className={dashInputClass}
                />
              </Field>
              <Field label="Supplier name" className="sm:col-span-2">
                <input
                  value={form.supplierName}
                  onChange={(e) => updateField("supplierName", e.target.value)}
                  className={dashInputClass}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Shipment"
            description="Routing, references, and transport documents."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Country of export" htmlFor="country-of-export">
                <CountrySearchSelect
                  id="country-of-export"
                  value={form.countryOfExportCode}
                  onChange={(code) => updateField("countryOfExportCode", code)}
                />
              </Field>
              <Field label="Country of origin" htmlFor="country-of-origin">
                <CountrySearchSelect
                  id="country-of-origin"
                  value={form.countryOfOriginCode}
                  onChange={(code) => updateField("countryOfOriginCode", code)}
                />
              </Field>
              <Field label="Shipment reference">
                <input
                  value={form.shipmentReference}
                  onChange={(e) =>
                    updateField("shipmentReference", e.target.value)
                  }
                  className={dashInputClass}
                />
              </Field>
              <Field label="Bill of lading">
                <input
                  value={form.billOfLadingNumber}
                  onChange={(e) =>
                    updateField("billOfLadingNumber", e.target.value)
                  }
                  className={dashInputClass}
                />
              </Field>
              <Field label="Airway bill">
                <input
                  value={form.airwayBillNumber}
                  onChange={(e) =>
                    updateField("airwayBillNumber", e.target.value)
                  }
                  className={dashInputClass}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Trade terms"
            description="Customs procedure, incoterm, and invoice currency."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Procedure code">
                <input
                  value={form.importProcedureCode}
                  onChange={(e) =>
                    updateField("importProcedureCode", e.target.value)
                  }
                  className={dashInputClass}
                />
              </Field>
              <Field label="Incoterm">
                <input
                  value={form.incoterm}
                  onChange={(e) => updateField("incoterm", e.target.value)}
                  placeholder="e.g. FOB"
                  className={dashInputClass}
                />
              </Field>
              <Field label="Invoice currency">
                <input
                  value={form.invoiceCurrencyCode}
                  onChange={(e) =>
                    updateField(
                      "invoiceCurrencyCode",
                      e.target.value.toUpperCase(),
                    )
                  }
                  placeholder="e.g. USD"
                  maxLength={3}
                  className={dashInputClass}
                />
              </Field>
              <Field label="Assigned clearing agent" htmlFor="assigned-agent">
                <select
                  id="assigned-agent"
                  value={form.assignedAgentId}
                  onChange={(e) => updateField("assignedAgentId", e.target.value)}
                  className={`w-full ${dashSelectClass}`}
                >
                  <option value="">Unassigned</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.fullName ?? agent.email}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </FormSection>

          <FormSection title="Notes" description="Internal notes for this case.">
            <Field label="Notes" htmlFor="case-notes">
              <textarea
                id="case-notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={3}
                className={`${dashInputClass} pl-3 resize-y min-h-20`}
              />
            </Field>
          </FormSection>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 bg-slate-50/60">
            <p className="text-xs text-slate-500">
              {dirty
                ? "You have unsaved changes."
                : "Review details, then continue to upload documents."}
            </p>
            <DashButton type="submit" disabled={loading || !dirty}>
              {loading ? "Saving…" : "Save changes"}
            </DashButton>
          </div>
        </form>
      </DashCard>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-5 py-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  className = "",
  children,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const autoId = useId();
  const fieldId = htmlFor ?? autoId;
  const control =
    isValidElement(children) && !htmlFor
      ? cloneElement(children as React.ReactElement<{ id?: string }>, {
          id: fieldId,
        })
      : children;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={fieldId} className="block text-xs font-medium text-slate-600">
        {label}
      </label>
      {control}
    </div>
  );
}
