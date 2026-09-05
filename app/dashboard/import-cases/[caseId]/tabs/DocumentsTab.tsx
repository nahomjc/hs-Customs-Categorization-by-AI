"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DashButton,
  DashCard,
  DashCardHeader,
  DashTable,
  DashTableHead,
  DashTableHeaderRow,
  DashTbody,
  DashTd,
  DashTh,
  DashTr,
  StatusBadge,
  dashSelectClass,
} from "@/components/dashboard/ui";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  type DocumentType,
} from "@/lib/import-cases/constants";
import type { ImportCaseDocumentRow } from "@/db/schema/importCaseDocuments";
import { formatBytes } from "@/lib/formatBytes";

type DocumentsTabProps = {
  caseId: string;
  initialDocuments: ImportCaseDocumentRow[];
};

const ACCEPTED_FILES =
  ".pdf,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg,application/pdf";

const EXTRACTION_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Extracted",
  failed: "Failed",
  reviewed: "Reviewed",
};

const REQUIRED_TYPES: DocumentType[] = [
  "commercial_invoice",
  "packing_list",
];

export function DocumentsTab({
  caseId,
  initialDocuments,
}: DocumentsTabProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploadType, setUploadType] = useState<DocumentType>("commercial_invoice");
  const [loading, setLoading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const invoiceDocs = useMemo(
    () => documents.filter((d) => d.documentType === "commercial_invoice"),
    [documents],
  );
  const packingDocs = useMemo(
    () => documents.filter((d) => d.documentType === "packing_list"),
    [documents],
  );
  const requiredComplete = invoiceDocs.length > 0 && packingDocs.length > 0;

  async function refreshDocuments() {
    const res = await fetch(`/api/import-cases/${caseId}/documents`);
    if (!res.ok) return;
    const data = (await res.json()) as { documents: ImportCaseDocumentRow[] };
    setDocuments(data.documents);
    router.refresh();
  }

  async function handleUpload(file: File) {
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("documentType", uploadType);
      const res = await fetch(`/api/import-cases/${caseId}/documents`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        error?: string;
        extraction?: {
          lineCount: number;
          extractionStatus: string;
          error?: string;
        };
      };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      if (data.extraction?.extractionStatus === "completed") {
        toast.success(
          `Document uploaded — ${data.extraction.lineCount} line(s) extracted`,
        );
      } else if (data.extraction?.error) {
        toast.error(`Uploaded but extraction failed: ${data.extraction.error}`);
      } else {
        toast.success("Document uploaded");
      }
      await refreshDocuments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleExtract(documentId: string) {
    setExtractingId(documentId);
    try {
      const res = await fetch(
        `/api/import-cases/${caseId}/documents/${documentId}/extract`,
        { method: "POST" },
      );
      const data = (await res.json()) as {
        error?: string;
        extraction?: {
          lineCount: number;
          extractionStatus: string;
          error?: string;
        };
      };
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");

      if (data.extraction?.extractionStatus === "completed") {
        toast.success(`Extracted ${data.extraction.lineCount} line(s)`);
      } else {
        toast.error(data.extraction?.error ?? "Extraction failed");
      }
      await refreshDocuments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Extraction failed");
    } finally {
      setExtractingId(null);
    }
  }

  function openUpload(type: DocumentType) {
    setUploadType(type);
    fileRef.current?.click();
  }

  function onFileSelected(file: File | undefined) {
    if (file) void handleUpload(file);
  }

  return (
    <DashCard>
      <DashCardHeader
        title="Case documents"
        action={
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
              requiredComplete
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {requiredComplete ? "Required docs complete" : "2 documents required"}
          </span>
        }
      />

      <section className="px-5 py-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Required documents
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Upload a commercial invoice and packing list to continue the workflow.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <RequiredDocumentSlot
            type="commercial_invoice"
            documents={invoiceDocs}
            loading={loading && uploadType === "commercial_invoice"}
            extractingId={extractingId}
            onUpload={() => openUpload("commercial_invoice")}
            onExtract={handleExtract}
          />
          <RequiredDocumentSlot
            type="packing_list"
            documents={packingDocs}
            loading={loading && uploadType === "packing_list"}
            extractingId={extractingId}
            onUpload={() => openUpload("packing_list")}
            onExtract={handleExtract}
          />
        </div>
      </section>

      <section className="border-t border-slate-100 px-5 py-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Upload file</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Lines are extracted automatically after upload. Supported: PDF, Word,
            Excel, CSV, and images.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label htmlFor="document-type" className="text-xs font-medium text-slate-600 shrink-0">
            Document type
          </label>
          <select
            id="document-type"
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value as DocumentType)}
            className={`w-full sm:max-w-xs ${dashSelectClass}`}
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {DOCUMENT_TYPE_LABELS[type]}
                {REQUIRED_TYPES.includes(type) ? " *" : ""}
              </option>
            ))}
          </select>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            onFileSelected(e.dataTransfer.files[0]);
          }}
          className={`rounded-2xl border-2 border-dashed transition-colors ${
            dragActive
              ? "border-indigo-400 bg-indigo-50/50"
              : "border-slate-200 bg-slate-50/40 hover:border-slate-300"
          }`}
        >
          <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
              <UploadIcon />
            </div>
            <p className="text-sm font-medium text-slate-800">
              {dragActive ? "Drop file to upload" : "Drag and drop a file here"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Uploading as{" "}
              <span className="font-medium text-slate-700">
                {DOCUMENT_TYPE_LABELS[uploadType]}
              </span>
            </p>
            <DashButton
              type="button"
              variant="secondary"
              className="mt-4"
              disabled={loading}
              onClick={() => fileRef.current?.click()}
            >
              {loading ? "Uploading…" : "Browse files"}
            </DashButton>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_FILES}
          onChange={(e) => onFileSelected(e.target.files?.[0])}
        />
      </section>

      {documents.length > 0 ? (
        <section className="border-t border-slate-100">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              Uploaded files
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {documents.length} document{documents.length === 1 ? "" : "s"} on
              this case
            </p>
          </div>
          <DashTable tableClassName="min-w-[640px]">
            <DashTableHead>
              <DashTableHeaderRow>
                <DashTh>File</DashTh>
                <DashTh>Type</DashTh>
                <DashTh>Status</DashTh>
                <DashTh>Extraction</DashTh>
                <DashTh align="right">Actions</DashTh>
              </DashTableHeaderRow>
            </DashTableHead>
            <DashTbody>
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  extractingId={extractingId}
                  onExtract={handleExtract}
                />
              ))}
            </DashTbody>
          </DashTable>
        </section>
      ) : null}
    </DashCard>
  );
}

function RequiredDocumentSlot({
  type,
  documents,
  loading,
  extractingId,
  onUpload,
  onExtract,
}: {
  type: DocumentType;
  documents: ImportCaseDocumentRow[];
  loading: boolean;
  extractingId: string | null;
  onUpload: () => void;
  onExtract: (id: string) => void;
}) {
  const latest = documents[0];
  const complete =
    latest &&
    (latest.extractionStatus === "completed" ||
      latest.extractionStatus === "reviewed");

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        complete
          ? "border-emerald-200 bg-emerald-50/40"
          : latest
            ? "border-indigo-200 bg-indigo-50/30"
            : "border-dashed border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            complete
              ? "bg-emerald-100 text-emerald-700"
              : latest
                ? "bg-indigo-100 text-indigo-700"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          {complete ? <CheckIcon /> : <DocumentTypeIcon type={type} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {DOCUMENT_TYPE_LABELS[type]}
          </p>
          {latest ? (
            <>
              <p className="mt-1 truncate text-xs text-slate-600">
                {latest.originalFileName}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge
                  label={EXTRACTION_LABELS[latest.extractionStatus ?? "pending"] ?? latest.extractionStatus ?? "Pending"}
                  status={latest.extractionStatus ?? "pending"}
                />
                {documents.length > 1 ? (
                  <span className="text-[11px] text-slate-400">
                    +{documents.length - 1} more
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <p className="mt-1 text-xs text-slate-500">Not uploaded yet</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <DashButton
          type="button"
          variant={latest ? "secondary" : "primary"}
          className="text-xs px-3 py-2"
          disabled={loading}
          onClick={onUpload}
        >
          {loading ? "Uploading…" : latest ? "Replace file" : "Upload file"}
        </DashButton>
        {latest &&
        (latest.extractionStatus === "pending" ||
          latest.extractionStatus === "failed") ? (
          <DashButton
            type="button"
            variant="ghost"
            className="text-xs px-3 py-2"
            disabled={extractingId === latest.id}
            onClick={() => onExtract(latest.id)}
          >
            {extractingId === latest.id ? "Extracting…" : "Extract now"}
          </DashButton>
        ) : null}
      </div>
    </div>
  );
}

function DocumentRow({
  doc,
  extractingId,
  onExtract,
}: {
  doc: ImportCaseDocumentRow;
  extractingId: string | null;
  onExtract: (id: string) => void;
}) {
  const type = doc.documentType as DocumentType;

  return (
    <DashTr>
      <DashTd>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
            <FileIcon fileName={doc.originalFileName} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-gray-900">
              {doc.originalFileName}
            </p>
            <p className="text-xs text-gray-500">
              {doc.fileSizeBytes ? formatBytes(doc.fileSizeBytes) : "—"}
              {doc.documentNumber ? ` · #${doc.documentNumber}` : ""}
            </p>
          </div>
        </div>
      </DashTd>
      <DashTd muted>
        {DOCUMENT_TYPE_LABELS[type] ?? doc.documentType}
      </DashTd>
      <DashTd>
        <StatusBadge label={doc.status ?? "uploaded"} status={doc.status ?? "uploaded"} />
      </DashTd>
      <DashTd>
        <StatusBadge
          label={EXTRACTION_LABELS[doc.extractionStatus ?? "pending"] ?? doc.extractionStatus ?? "Pending"}
          status={doc.extractionStatus ?? "pending"}
        />
      </DashTd>
      <DashTd align="right">
        {(doc.extractionStatus === "pending" ||
          doc.extractionStatus === "failed") && (
          <DashButton
            type="button"
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            disabled={extractingId === doc.id}
            onClick={() => onExtract(doc.id)}
          >
            {extractingId === doc.id ? "Extracting…" : "Extract"}
          </DashButton>
        )}
      </DashTd>
    </DashTr>
  );
}

function DocumentTypeIcon({ type }: { type: DocumentType }) {
  if (type === "packing_list") {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <title>Packing list</title>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <title>Commercial invoice</title>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function FileIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <title>PDF file</title>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <title>Document file</title>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7h16M4 7l2-4h12l2 4" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <title>Upload</title>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <title>Complete</title>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
