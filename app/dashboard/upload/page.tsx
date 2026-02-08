"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ALLOWED = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const EXT: Record<string, "pdf" | "xlsx" | "docx"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

const FORMATS = [
  { ext: "PDF", label: "PDF" },
  { ext: "DOCX", label: "Word" },
  { ext: "XLSX", label: "Excel" },
] as const;

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const router = useRouter();

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f && ALLOWED.includes(f.type)) {
      setFile(f);
      setError(null);
    } else setError("Please use PDF, Word, or Excel.");
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => setDragActive(false);

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && ALLOWED.includes(f.type)) {
      setFile(f);
      setError(null);
    } else setError("Please use PDF, Word, or Excel.");
  };

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("fileType", EXT[file.type] ?? "pdf");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      router.push(`/dashboard/documents/${data.documentId}`);
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
    <div className="max-w-xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
          Upload packing list
        </h1>
        <p className="mt-1 text-[var(--foreground)]/70">
          Upload a PDF, Word, or Excel file to categorize items by HS code.
        </p>
      </div>

      <div className="space-y-6">
        {/* Drop zone card */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`rounded-xl border-2 border-dashed transition-all ${
            dragActive
              ? "border-[var(--accent)] bg-[var(--accent-light)]/30"
              : "border-[var(--border)] bg-[var(--background-card)] hover:border-[var(--foreground)]/20 hover:bg-[var(--background)]/50"
          }`}
        >
          <div className="p-8 sm:p-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent-light)] flex items-center justify-center mx-auto mb-4 text-[var(--accent)]">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p className="font-medium text-[var(--foreground)] mb-1">
              {dragActive ? "Drop file here" : "Drag and drop your file here"}
            </p>
            <p className="text-sm text-[var(--foreground)]/60 mb-5">
              or choose a file from your device
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--dark-bg)] text-[var(--dark-foreground)] rounded-lg cursor-pointer hover:bg-[var(--dark-bg-elevated)] transition-colors font-medium text-sm">
              <svg
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
                accept=".pdf,.docx,.xlsx"
                className="hidden"
                onChange={onSelect}
              />
            </label>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {FORMATS.map(({ ext, label }) => (
                <span
                  key={ext}
                  className="px-2.5 py-1 rounded-md bg-[var(--background)] text-xs font-medium text-[var(--foreground)]/70"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Selected file */}
        {file && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--background-card)] border border-[var(--border)]">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <svg
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
              <p className="font-medium text-[var(--foreground)] truncate">
                {file.name}
              </p>
              <p className="text-xs text-[var(--foreground)]/60">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={removeFile}
              className="shrink-0 p-2 rounded-lg text-[var(--foreground)]/60 hover:bg-[var(--background)] hover:text-[var(--foreground)] transition-colors"
              aria-label="Remove file"
            >
              <svg
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

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm">
            <svg
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

        {/* Submit */}
        <button
          onClick={submit}
          disabled={!file || loading}
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 bg-[var(--accent)] text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden
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

        <p className="text-center text-sm text-[var(--foreground)]/60">
          <Link
            href="/dashboard"
            className="text-[var(--accent)] hover:underline font-medium"
          >
            ← Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
