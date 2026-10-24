import type { ReactNode } from "react";
import { BentoCard, BentoCardHeader } from "@/components/dashboard/bento/BentoCard";
import { BentoIcon } from "@/components/dashboard/bento/icons";
import { StatusBadge } from "@/components/dashboard/ui";
import type { ImportCaseRow } from "@/db/schema/importCases";
import type { ImportCaseDocumentRow } from "@/db/schema/importCaseDocuments";
import { getCountryLabel } from "@/lib/countries";
import { formatAuditAction } from "@/lib/import-cases/audit-labels";
import type { AuditLogView } from "@/lib/import-cases/audit-queries";
import {
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
} from "@/lib/import-cases/constants";

const linkButtonClass =
  "rounded-lg px-2 py-1 text-xs font-semibold text-[#007bff] transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007bff]/40";

function humanize(value: string): string {
  const text = value.replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function formatMoney(
  amount: string | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (amount === null || amount === undefined || amount === "") return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium text-slate-900">
        {children}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Case details: assignee, client, shipment references, notes                  */
/* -------------------------------------------------------------------------- */

export function CaseDetailsCard({
  importCase,
  agents,
  client,
}: {
  importCase: ImportCaseRow;
  agents: { id: string; fullName: string | null; email: string }[];
  client: {
    id: string;
    fullName: string | null;
    email: string;
    phone: string | null;
  } | null;
}) {
  const agent = importCase.assignedAgentId
    ? agents.find((a) => a.id === importCase.assignedAgentId)
    : undefined;
  const currency = importCase.invoiceCurrencyCode;

  const rows: { label: string; value: ReactNode }[] = [];
  if (importCase.importerName) {
    rows.push({
      label: "Importer",
      value: (
        <>
          {importCase.importerName}
          {importCase.importerTinNumber ? (
            <span className="block text-xs font-normal text-slate-500">
              TIN {importCase.importerTinNumber}
            </span>
          ) : null}
        </>
      ),
    });
  }
  rows.push({
    label: "Assigned agent",
    value: agent ? (
      <>
        {agent.fullName?.trim() || agent.email}
        {agent.fullName?.trim() ? (
          <span className="block text-xs font-normal text-slate-500">{agent.email}</span>
        ) : null}
      </>
    ) : (
      <span className="font-normal text-slate-400">Unassigned</span>
    ),
  });
  rows.push({
    label: "Client",
    value: client ? (
      <>
        {client.fullName?.trim() || client.email}
        {client.fullName?.trim() ? (
          <span className="block text-xs font-normal text-slate-500">{client.email}</span>
        ) : null}
        {client.phone ? (
          <span className="block text-xs font-normal text-slate-500">{client.phone}</span>
        ) : null}
      </>
    ) : (
      <span className="font-normal text-slate-400">No client linked</span>
    ),
  });
  if (importCase.countryOfExportCode) {
    rows.push({
      label: "Country of export",
      value: getCountryLabel(importCase.countryOfExportCode),
    });
  }
  if (importCase.billOfLadingNumber) {
    rows.push({ label: "Bill of lading", value: importCase.billOfLadingNumber });
  }
  if (importCase.airwayBillNumber) {
    rows.push({ label: "Airway bill", value: importCase.airwayBillNumber });
  }
  if (importCase.importProcedureCode) {
    rows.push({ label: "Import procedure", value: importCase.importProcedureCode });
  }
  const freight = formatMoney(importCase.freightAmount, currency);
  if (freight) rows.push({ label: "Freight", value: freight });
  const insurance = formatMoney(importCase.insuranceAmount, currency);
  if (insurance) rows.push({ label: "Insurance", value: insurance });
  const cif = formatMoney(importCase.estimatedCifAmount, currency);
  if (cif) rows.push({ label: "Estimated CIF", value: cif });
  if (importCase.trackingStatus) {
    rows.push({ label: "Tracking", value: humanize(importCase.trackingStatus) });
  }

  const notes = importCase.notes?.trim();

  return (
    <BentoCard label="Case details">
      <BentoCardHeader title="Case details" className="mb-2" />
      <dl className="divide-y divide-slate-100">
        {rows.map((row) => (
          <DetailRow key={row.label} label={row.label}>
            {row.value}
          </DetailRow>
        ))}
      </dl>
      {notes ? (
        <div className="mt-3 rounded-xl bg-slate-50 px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Notes
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {notes}
          </p>
        </div>
      ) : null}
    </BentoCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

const EXTRACTION_TEXT: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Extracted",
  failed: "Failed",
  reviewed: "Reviewed",
};

const MAX_DOCS = 6;

export function CaseDocumentsCard({
  documents,
  onManage,
}: {
  documents: ImportCaseDocumentRow[];
  onManage?: () => void;
}) {
  const shown = documents.slice(0, MAX_DOCS);
  const extra = documents.length - shown.length;

  return (
    <BentoCard label="Documents">
      <BentoCardHeader
        title="Documents"
        className="mb-2"
        action={
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600">
              {documents.length}
            </span>
            {onManage ? (
              <button type="button" onClick={onManage} className={linkButtonClass}>
                Manage
              </button>
            ) : null}
          </div>
        }
      />
      {documents.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#007bff]">
            <BentoIcon name="upload" className="h-5 w-5" />
          </div>
          <p className="text-sm text-slate-500">
            No documents uploaded yet. Upload a commercial invoice and packing
            list to start extraction.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {shown.map((doc) => {
            const typeLabel =
              DOCUMENT_TYPE_LABELS[doc.documentType as DocumentType] ??
              humanize(doc.documentType);
            const extraction = doc.extractionStatus ?? "pending";
            return (
              <li key={doc.id} className="flex items-center gap-3 py-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <BentoIcon name="document" className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-semibold text-slate-900"
                    title={doc.originalFileName}
                  >
                    {doc.originalFileName}
                  </p>
                  <p className="truncate text-xs text-slate-500">{typeLabel}</p>
                </div>
                <StatusBadge
                  label={EXTRACTION_TEXT[extraction] ?? humanize(extraction)}
                  status={extraction}
                />
              </li>
            );
          })}
        </ul>
      )}
      {extra > 0 ? (
        <p className="mt-2 text-xs font-medium text-slate-400">
          +{extra} more document{extra === 1 ? "" : "s"}
        </p>
      ) : null}
    </BentoCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Recent activity                                                             */
/* -------------------------------------------------------------------------- */

const MAX_ACTIVITY = 5;

function actorLabel(entry: AuditLogView): string {
  if (entry.userFullName?.trim()) return entry.userFullName.trim();
  if (entry.userEmail) return entry.userEmail;
  return "System";
}

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export function CaseActivityCard({
  entries,
  onViewAll,
}: {
  entries: AuditLogView[];
  onViewAll?: () => void;
}) {
  const shown = entries.slice(0, MAX_ACTIVITY);

  return (
    <BentoCard label="Recent activity">
      <BentoCardHeader
        title="Recent activity"
        className="mb-3"
        action={
          onViewAll && entries.length > 0 ? (
            <button type="button" onClick={onViewAll} className={linkButtonClass}>
              View all
            </button>
          ) : null
        }
      />
      {shown.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3.5 py-4 text-sm text-slate-500">
          No activity yet. Actions on each step will show up here.
        </p>
      ) : (
        <ol className="relative ml-1.5 list-none border-l border-slate-200 pl-5">
          {shown.map((entry) => (
            <li key={entry.id} className="relative pb-4 last:pb-0">
              <span
                aria-hidden="true"
                className="absolute -left-5 top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[#007bff] ring-4 ring-white"
              />
              <p className="text-sm font-semibold text-slate-900">
                {formatAuditAction(entry.action)}
              </p>
              <p className="text-xs text-slate-500">
                {actorLabel(entry)}
                <span className="mx-1.5 text-slate-300" aria-hidden="true">
                  &middot;
                </span>
                <time
                  dateTime={new Date(entry.createdAt).toISOString()}
                  suppressHydrationWarning
                >
                  {formatWhen(entry.createdAt)}
                </time>
              </p>
            </li>
          ))}
        </ol>
      )}
    </BentoCard>
  );
}