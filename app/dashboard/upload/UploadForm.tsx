"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UploadFileType = "pdf" | "xlsx" | "docx" | "csv";

const MIME_TO_TYPE: Record<string, UploadFileType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "text/csv": "csv",
  "application/csv": "csv",
  "text/comma-separated-values": "csv",
};

const EXT_TO_TYPE: Record<string, UploadFileType> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  csv: "csv",
};

const FORMATS = [
  { ext: "PDF", label: "PDF" },
  { ext: "DOCX", label: "Word" },
  { ext: "XLSX", label: "Excel" },
  { ext: "CSV", label: "CSV" },
] as const;

function detectUploadFileType(file: File): UploadFileType | null {
  const mimeType = MIME_TO_TYPE[file.type];
  if (mimeType) return mimeType;

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && EXT_TO_TYPE[ext]) return EXT_TO_TYPE[ext];

  return null;
}

type UploadFormProps = {
  autoOpenDocument: boolean;
};

export function UploadForm({ autoOpenDocument }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const router = useRouter();

  const acceptFile = (f: File) => {
    const type = detectUploadFileType(f);
    if (type) {
      setFile(f);
      setError(null);
    } else {
      setError("Please use PDF, Word, Excel, or CSV.");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => setDragActive(false);

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
  };

  const submit = async () => {
    if (!file) return;
    const fileType = detectUploadFileType(file);
    if (!fileType) {
      setError("Please use PDF, Word, Excel, or CSV.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("fileType", fileType);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      if (autoOpenDocument) {
        router.push(`/dashboard/documents/${data.documentId}`);
      } else {
        router.push("/dashboard/history");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setError(null);
  };

  return (
    <div className="space-y-5">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`landing-float-card rounded-2xl border-2 border-dashed transition-all bg-white ${
          dragActive
            ? "border-[#007bff] bg-blue-50/50"
            : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <div className="p-8 sm:p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4 text-[#007bff]">
            <svg
              aria-hidden="true"
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <p className="font-semibold text-gray-900 mb-1">
            {dragActive ? "Drop file here" : "Drag and drop your file here"}
          </p>
          <p className="text-sm text-gray-500 mb-5">
            or choose a file from your device
          </p>
          <p className="text-xs text-gray-400 mb-5 max-w-sm mx-auto">
            Scanned or image-only PDFs are read automatically; processing may
            take a little longer.
          </p>
          <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white cursor-pointer hover:bg-gray-800 transition-colors font-medium text-sm">
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Browse file
            <input
              type="file"
              accept=".pdf,.docx,.xlsx,.csv,text/csv"
              className="hidden"
              onChange={onSelect}
            />
          </label>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {FORMATS.map(({ ext, label }) => (
              <span
                key={ext}
                className="px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {file && (
        <div className="landing-float-card flex items-center gap-3 p-4 rounded-2xl bg-white">
          <div className="shrink-0 w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <svg
              aria-hidden="true"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 truncate">{file.name}</p>
            <p className="text-xs text-gray-500">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            type="button"
            onClick={removeFile}
            className="shrink-0 p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Remove file"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-800 text-sm">
          <svg
            aria-hidden="true"
            className="w-5 h-5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!file || loading}
        className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-full bg-[#007bff] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#0069d9] transition-colors shadow-md shadow-blue-500/20"
      >
        {loading ? (
          <>
            <svg
              aria-hidden="true"
              className="animate-spin w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Processing…
          </>
        ) : (
          <>
            Process and categorize
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}
