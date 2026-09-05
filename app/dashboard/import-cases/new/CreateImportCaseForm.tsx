"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ClientSearchSelect,
  type ClientOption,
} from "@/components/dashboard/ClientSearchSelect";
import {
  DashButton,
  DashCard,
  dashInputClass,
  dashSelectClass,
} from "@/components/dashboard/ui";
import { CountrySearchSelect } from "@/components/dashboard/CountrySearchSelect";

type AgentOption = {
  id: string;
  fullName: string | null;
  email: string;
};

type CreateImportCaseFormProps = {
  agents: AgentOption[];
};

export function CreateImportCaseForm({ agents }: CreateImportCaseFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clientLabel, setClientLabel] = useState("");
  const [form, setForm] = useState({
    importerName: "Impact logistic",
    supplierName: "",
    countryOfExportCode: "",
    countryOfOriginCode: "",
    shipmentReference: "",
    importProcedureCode: "",
    incoterm: "",
    assignedAgentId: "",
    clientUserId: "",
    notes: "",
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientUserId) {
      toast.error("Please select a client");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/import-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importerName: form.importerName,
          supplierName: form.supplierName || null,
          countryOfExportCode: form.countryOfExportCode || null,
          countryOfOriginCode: form.countryOfOriginCode || null,
          shipmentReference: form.shipmentReference || null,
          importProcedureCode: form.importProcedureCode || null,
          incoterm: form.incoterm || null,
          assignedAgentId: form.assignedAgentId || null,
          clientUserId: form.clientUserId,
          notes: form.notes || null,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create import case");
      }
      toast.success("Import case created");
      router.push(`/dashboard/import-cases/${data.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create import case",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashCard>
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
        <Field label="Client *" htmlFor="client-user">
          <ClientSearchSelect
            id="client-user"
            required
            value={form.clientUserId}
            selectedLabel={clientLabel || null}
            onChange={(clientId, client?: ClientOption | null) => {
              updateField("clientUserId", clientId);
              setClientLabel(
                client
                  ? `${client.fullName ?? client.email}${
                      client.phone ? ` · ${client.phone}` : ""
                    }`
                  : "",
              );
            }}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Importer name *">
            <input
              required
              value={form.importerName}
              onChange={(e) => updateField("importerName", e.target.value)}
              className={dashInputClass}
            />
          </Field>
          <Field label="Supplier name">
            <input
              value={form.supplierName}
              onChange={(e) => updateField("supplierName", e.target.value)}
              className={dashInputClass}
            />
          </Field>
          <Field label="Country of export (ISO)" htmlFor="country-of-export">
            <CountrySearchSelect
              id="country-of-export"
              value={form.countryOfExportCode}
              onChange={(code) => updateField("countryOfExportCode", code)}
            />
          </Field>
          <Field label="Country of origin (ISO)" htmlFor="country-of-origin">
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
        </div>
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
        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            rows={4}
            className={`${dashInputClass} pl-3`}
          />
        </Field>
        <div className="flex gap-3">
          <DashButton type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create import case"}
          </DashButton>
          <DashButton
            variant="secondary"
            href="/dashboard/import-cases"
          >
            Cancel
          </DashButton>
        </div>
      </form>
    </DashCard>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block space-y-1.5">
      <label
        {...(htmlFor ? { htmlFor } : {})}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
