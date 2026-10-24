"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DashButton,
  dashSelectClass,
} from "@/components/dashboard/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Confidence = "high" | "medium" | "low" | "none";

type FieldSuggestion = {
  fieldKey: string;
  columnIndex: number | null;
  confidence: Confidence;
  ambiguous: boolean;
};

type FieldInfo = {
  key: string;
  label: string;
  required: boolean;
  requiredGroup: string | null;
  storage: "column" | "extra";
};

type ColumnsPayload = {
  fileName: string;
  kind: "invoice" | "packing_list";
  sheets: Array<{ name: string; rowCount: number; usable: boolean }>;
  sheetName: string;
  headerRow: number;
  totalRows: number;
  headers: Array<{ index: number; label: string }>;
  previewRows: string[][];
  fields: FieldInfo[];
  suggestions: Record<string, FieldSuggestion>;
  sure: boolean;
  reasons: string[];
  warnings: string[];
  initialMapping: {
    fields: Record<string, number | null>;
    extraColumns?: Record<string, "extra" | "ignore">;
  };
  initialSource: "current" | "saved" | "suggested";
};

type Edit = {
  key: string;
  fields: Record<string, number | null>;
  extraColumns: Record<string, "extra" | "ignore">;
};

type ApplyResponse = {
  error?: string;
  extraction?: {
    lineCount?: number;
    warnings?: string[];
    issues?: Array<{ message: string }>;
    error?: string;
  };
};

type MapColumnsDialogProps = {
  caseId: string;
  /** Document to map; the dialog is open while this is set. */
  documentId: string | null;
  onClose: () => void;
  /** Called after lines were imported (refresh the document list). */
  onApplied: () => void | Promise<void>;
};

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  high: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-orange-50 text-orange-700",
  none: "bg-slate-100 text-slate-500",
};

function columnLetter(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function MapColumnsDialog({
  caseId,
  documentId,
  onClose,
  onApplied,
}: MapColumnsDialogProps) {
  return (
    <Dialog open={documentId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto rounded-3xl shadow-none!">
        {documentId ? (
          <MapColumnsBody
            key={documentId}
            caseId={caseId}
            documentId={documentId}
            onClose={onClose}
            onApplied={onApplied}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ConfidenceBadge({ confidence, text }: { confidence: Confidence; text?: string }) {
  const labels: Record<Confidence, string> = {
    high: "Sure",
    medium: "Check",
    low: "Unsure",
    none: "Not found",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${CONFIDENCE_STYLES[confidence]}`}
    >
      {text ?? labels[confidence]}
    </span>
  );
}

function MapColumnsBody({
  caseId,
  documentId,
  onClose,
  onApplied,
}: Omit<MapColumnsDialogProps, "documentId"> & { documentId: string }) {
  const [sheetOverride, setSheetOverride] = useState<string | undefined>();
  const [headerRowOverride, setHeaderRowOverride] = useState<number | undefined>();
  const [result, setResult] = useState<{
    key: string;
    data?: ColumnsPayload;
    error?: string;
  } | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [remember, setRemember] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyIssues, setApplyIssues] = useState<string[]>([]);

  const requestKey = `${sheetOverride ?? ""}|${headerRowOverride ?? ""}`;

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams();
    if (sheetOverride) qs.set("sheet", sheetOverride);
    if (headerRowOverride) qs.set("headerRow", String(headerRowOverride));
    const url = `/api/import-cases/${caseId}/documents/${documentId}/columns${
      qs.toString() ? `?${qs}` : ""
    }`;
    fetch(url)
      .then(async (res) => {
        const body = (await res.json()) as ColumnsPayload & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setResult({ key: requestKey, error: body.error ?? "Could not read the file" });
          return;
        }
        setResult({ key: requestKey, data: body });
        setEdit({
          key: requestKey,
          fields: { ...body.initialMapping.fields },
          extraColumns: { ...(body.initialMapping.extraColumns ?? {}) },
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setResult({
          key: requestKey,
          error: error instanceof Error ? error.message : "Could not read the file",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, documentId, sheetOverride, headerRowOverride, requestKey]);

  const current = result && result.key === requestKey ? result : null;
  const data = current?.data;
  const fields = edit && edit.key === requestKey ? edit.fields : null;
  const extraColumns = edit && edit.key === requestKey ? edit.extraColumns : null;

  const usedColumns = useMemo(() => {
    const used = new Map<number, string>();
    if (!data || !fields) return used;
    for (const def of data.fields) {
      const idx = fields[def.key];
      if (idx !== null && idx !== undefined) used.set(idx, def.key);
    }
    return used;
  }, [data, fields]);

  const problems = useMemo(() => {
    if (!data || !fields) return [] as string[];
    const out: string[] = [];
    for (const def of data.fields) {
      if (def.required && (fields[def.key] ?? null) === null) {
        out.push(`${def.label} must be mapped`);
      }
    }
    const groups = new Map<string, FieldInfo[]>();
    for (const def of data.fields) {
      if (def.requiredGroup) {
        groups.set(def.requiredGroup, [...(groups.get(def.requiredGroup) ?? []), def]);
      }
    }
    for (const members of groups.values()) {
      if (!members.some((m) => (fields[m.key] ?? null) !== null)) {
        out.push(`Map at least one of: ${members.map((m) => m.label).join(" / ")}`);
      }
    }
    return out;
  }, [data, fields]);

  function setField(fieldKey: string, value: string) {
    setEdit((prev) => {
      if (!prev) return prev;
      const next = { ...prev.fields };
      if (value === "") {
        next[fieldKey] = null;
      } else {
        const idx = Number(value);
        // a column can only feed one field: release it from any other field
        for (const [k, v] of Object.entries(next)) {
          if (v === idx && k !== fieldKey) next[k] = null;
        }
        next[fieldKey] = idx;
      }
      return { ...prev, fields: next };
    });
  }

  function setExtraMode(columnIndex: number, mode: "extra" | "ignore") {
    setEdit((prev) =>
      prev
        ? { ...prev, extraColumns: { ...prev.extraColumns, [String(columnIndex)]: mode } }
        : prev,
    );
  }

  async function apply(mode: "mapping" | "ai") {
    if (!data || !fields || !extraColumns) return;
    setApplying(true);
    setApplyError(null);
    setApplyIssues([]);
    try {
      const res = await fetch(
        `/api/import-cases/${caseId}/documents/${documentId}/columns`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            sheetName: data.sheetName,
            headerRow: data.headerRow,
            mapping: fields,
            extraColumns,
            remember,
          }),
        },
      );
      const body = (await res.json()) as ApplyResponse;
      if (!res.ok || body.extraction?.error) {
        setApplyError(body.error ?? body.extraction?.error ?? "Import failed");
        setApplyIssues((body.extraction?.issues ?? []).map((i) => i.message));
        return;
      }
      const lines = body.extraction?.lineCount ?? 0;
      toast.success(`${lines} line(s) imported`);
      for (const warning of (body.extraction?.warnings ?? []).slice(0, 3)) {
        toast.message(warning);
      }
      await onApplied();
      onClose();
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : "Import failed");
    } finally {
      setApplying(false);
    }
  }

  const usableSheets = data?.sheets.filter((s) => s.usable) ?? [];
  const unmapped = data
    ? data.headers.filter((h) => !usedColumns.has(h.index))
    : [];

  return (
    <>
      <DialogHeader>
        <DialogTitle>Map columns</DialogTitle>
        <DialogDescription>
          {data
            ? `${data.fileName} - ${data.totalRows} data row${data.totalRows === 1 ? "" : "s"} on sheet "${data.sheetName}". Pick which column holds each field.`
            : "Reading your file..."}
        </DialogDescription>
      </DialogHeader>

      {!data && !current?.error ? (
        <p className="py-10 text-center text-sm text-slate-500">Reading columns...</p>
      ) : null}

      {current?.error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {current.error}
        </div>
      ) : null}

      {data && fields && extraColumns ? (
        <div className="space-y-5">
          {data.reasons.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-900">
                We are not sure about this file
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-amber-800">
                {data.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-3">
            {usableSheets.length > 1 ? (
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Sheet
                <select
                  className={`block ${dashSelectClass}`}
                  value={data.sheetName}
                  onChange={(e) => {
                    setHeaderRowOverride(undefined);
                    setSheetOverride(e.target.value);
                  }}
                >
                  {usableSheets.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name} ({s.rowCount} rows)
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Header row
              <select
                className={`block ${dashSelectClass}`}
                value={data.headerRow}
                onChange={(e) => setHeaderRowOverride(Number(e.target.value))}
              >
                {Array.from({ length: Math.max(15, data.headerRow + 3) }, (_, i) => i + 1).map(
                  (n) => (
                    <option key={n} value={n}>
                      Row {n}
                    </option>
                  ),
                )}
              </select>
            </label>
            {data.initialSource !== "suggested" ? (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#007bff]">
                {data.initialSource === "saved"
                  ? "Using your saved mapping"
                  : "Showing the mapping used for this import"}
              </span>
            ) : null}
          </div>

          <section className="rounded-2xl border border-slate-200/70">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">File preview</h3>
              <p className="text-xs text-slate-500">First {data.previewRows.length} rows</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    {data.headers.map((h) => {
                      const fieldKey = usedColumns.get(h.index);
                      const def = data.fields.find((f) => f.key === fieldKey);
                      return (
                        <th
                          key={h.index}
                          className="whitespace-nowrap border-b border-slate-100 px-3 py-2 align-bottom font-semibold text-slate-700"
                        >
                          <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                            {columnLetter(h.index)}
                          </span>
                          {h.label}
                          {def ? (
                            <span className="mt-1 block">
                              <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#007bff]">
                                {def.label}
                              </span>
                            </span>
                          ) : null}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data.previewRows.map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-50 last:border-0">
                      {data.headers.map((h) => (
                        <td
                          key={h.index}
                          className="max-w-[220px] truncate whitespace-nowrap px-3 py-1.5 text-slate-700"
                          title={row[h.index] ?? ""}
                        >
                          {row[h.index] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/70">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Fields</h3>
              <p className="text-xs text-slate-500">
                Fields marked * are required. Everything else is optional.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 md:grid-cols-2">
              {data.fields.map((def) => {
                const selected = fields[def.key] ?? null;
                const suggestion = data.suggestions[def.key];
                const matchesSuggestion =
                  selected !== null && suggestion?.columnIndex === selected;
                const badge: { c: Confidence; text?: string } | null =
                  selected === null
                    ? def.required || def.requiredGroup
                      ? { c: "none", text: "Required" }
                      : null
                    : matchesSuggestion
                      ? { c: suggestion.ambiguous ? "medium" : suggestion.confidence }
                      : { c: "high", text: "Your choice" };
                return (
                  <div key={def.key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor={`map-${def.key}`}
                        className="text-xs font-semibold text-slate-700"
                      >
                        {def.label}
                        {def.required ? <span className="text-red-500"> *</span> : null}
                        {def.requiredGroup ? (
                          <span className="font-normal text-slate-400"> (one needed)</span>
                        ) : null}
                        {def.storage === "extra" ? (
                          <span className="font-normal text-slate-400"> - stored as extra</span>
                        ) : null}
                      </label>
                      {badge ? <ConfidenceBadge confidence={badge.c} text={badge.text} /> : null}
                    </div>
                    <select
                      id={`map-${def.key}`}
                      className={`w-full ${dashSelectClass}`}
                      value={selected === null ? "" : String(selected)}
                      onChange={(e) => setField(def.key, e.target.value)}
                    >
                      <option value="">- not mapped -</option>
                      {data.headers.map((h) => (
                        <option key={h.index} value={h.index}>
                          {columnLetter(h.index)} - {h.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </section>

          {unmapped.length > 0 ? (
            <section className="rounded-2xl border border-slate-200/70">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Other columns ({unmapped.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Keep them as extra fields on each line, or ignore them.
                </p>
              </div>
              <ul className="divide-y divide-slate-50">
                {unmapped.map((h) => {
                  const mode = extraColumns[String(h.index)] ?? "extra";
                  return (
                    <li
                      key={h.index}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2"
                    >
                      <span className="text-sm text-slate-800">
                        <span className="mr-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          {columnLetter(h.index)}
                        </span>
                        {h.label}
                      </span>
                      <select
                        aria-label={`What to do with ${h.label}`}
                        className={dashSelectClass}
                        value={mode}
                        onChange={(e) =>
                          setExtraMode(h.index, e.target.value as "extra" | "ignore")
                        }
                      >
                        <option value="extra">Keep as extra field</option>
                        <option value="ignore">Ignore</option>
                      </select>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {data.warnings.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-500">
              {data.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          {applyError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-semibold">{applyError}</p>
              {applyIssues.length > 0 ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                  {applyIssues.slice(0, 6).map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Remember this mapping for files with the same columns
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {problems.length > 0 ? (
                <span className="text-xs text-red-600">{problems[0]}</span>
              ) : null}
              <DashButton
                variant="ghost"
                disabled={applying}
                onClick={() => void apply("ai")}
              >
                Use AI instead
              </DashButton>
              <DashButton variant="secondary" disabled={applying} onClick={onClose}>
                Cancel
              </DashButton>
              <DashButton
                variant="primary"
                disabled={applying || problems.length > 0}
                onClick={() => void apply("mapping")}
              >
                {applying ? "Importing..." : `Import ${data.totalRows} rows`}
              </DashButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
