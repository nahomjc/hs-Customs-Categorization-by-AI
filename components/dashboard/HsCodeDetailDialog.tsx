"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { HsCodeBadge } from "@/components/dashboard/document/HsCodeBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  normalizeChapter,
  type ChapterNotesDetail,
} from "@/lib/hs-chapter-notes-schema";

export type HsCodeDetailRow = {
  heading: string | null;
  hsCode: string | null;
  tariffNo: string;
  description: string;
  stdUnit: string | null;
  dutyRate: string | null;
  chapter: string | null;
  normalizedHs: string | null;
};

// Flat styling on purpose (no shadows).
const primaryBtn =
  "inline-flex items-center justify-center rounded-xl bg-[#007bff] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0069d9] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryBtn =
  "inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const textareaClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-gray-900 focus:border-[#007bff] focus:outline-none focus:ring-[3px] focus:ring-[#007bff]/12";
const labelClass =
  "text-xs font-semibold uppercase tracking-wider text-gray-500";

type NotesState = {
  chapter: string | null;
  loading: boolean;
  error: string | null;
  note: ChapterNotesDetail | null;
  canEdit: boolean;
};

const EMPTY_STATE: NotesState = {
  chapter: null,
  loading: false,
  error: null,
  note: null,
  canEdit: false,
};

/** Chapter of a reference row: the stored chapter, else the HS code's first 2 digits. */
export function chapterOfRow(row: HsCodeDetailRow): string | null {
  const fromColumn = normalizeChapter(row.chapter);
  if (fromColumn) return fromColumn;
  const digits = (row.hsCode ?? row.normalizedHs ?? row.tariffNo ?? "").replace(
    /\D/g,
    "",
  );
  return normalizeChapter(digits.slice(0, 2));
}

function NotesText({ text }: { text: string }) {
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 font-sans text-sm leading-relaxed text-slate-700">
      {text}
    </pre>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className={labelClass}>{label}</p>
      <div className="text-sm text-slate-800">{children}</div>
    </div>
  );
}

export function HsCodeDetailDialog({
  row,
  onClose,
}: {
  row: HsCodeDetailRow | null;
  onClose: () => void;
}) {
  const chapter = row ? chapterOfRow(row) : null;
  const cache = useRef(
    new Map<string, { note: ChapterNotesDetail; canEdit: boolean }>(),
  );
  const [state, setState] = useState<NotesState>(EMPTY_STATE);
  const [editing, setEditing] = useState(false);
  const [draftNotes, setDraftNotes] = useState("");
  const [draftSection, setDraftSection] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (ch: string) => {
    const cached = cache.current.get(ch);
    if (cached) {
      setState({ chapter: ch, loading: false, error: null, ...cached });
      return;
    }
    setState({ ...EMPTY_STATE, chapter: ch, loading: true });
    try {
      const res = await fetch(`/api/dashboard/hs-reference/notes?chapter=${ch}`);
      const data = await res.json();
      if (res.status === 404) {
        setState({ ...EMPTY_STATE, chapter: ch });
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Failed to load notes");
      const entry = { note: data.note as ChapterNotesDetail, canEdit: !!data.canEdit };
      cache.current.set(ch, entry);
      setState({ chapter: ch, loading: false, error: null, ...entry });
    } catch (e) {
      setState({
        ...EMPTY_STATE,
        chapter: ch,
        error: e instanceof Error ? e.message : "Failed to load notes",
      });
    }
  }, []);

  useEffect(() => {
    setEditing(false);
    if (!chapter) {
      setState(EMPTY_STATE);
      return;
    }
    void load(chapter);
  }, [chapter, row, load]);

  const { note, canEdit } = state;
  // Ignore a response that belongs to a previously opened row.
  const ready = !!chapter && state.chapter === chapter;
  const loading = !!chapter && (!ready || state.loading);

  const startEdit = () => {
    if (!note) return;
    setDraftNotes(note.notes);
    setDraftSection(note.sectionNotes);
    setEditing(true);
  };

  const onSave = async () => {
    if (!note || !chapter) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/hs-reference/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapter,
          notes: draftNotes,
          ...(note.sectionNumber ? { sectionNotes: draftSection } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save notes");
      // Section notes are shared, so other cached chapters may be stale.
      cache.current.clear();
      cache.current.set(chapter, { note: data.note, canEdit: true });
      setState({
        chapter,
        loading: false,
        error: null,
        note: data.note,
        canEdit: true,
      });
      setEditing(false);
      toast.success(`Chapter ${chapter} notes saved`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  const hsDisplay = row ? (row.hsCode ?? row.normalizedHs) : null;
  const chapterTitle = ready ? note?.title : null;

  return (
    <Dialog open={!!row} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-2xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 shadow-none!">
        {row ? (
          <>
            <DialogHeader className="border-b border-slate-100 px-6 py-5 pr-12 text-left">
              <DialogTitle className="leading-snug">
                {row.heading ? `Heading ${row.heading}` : "HS reference"}
                {" - "}
                <span className="font-mono">{row.tariffNo}</span>
              </DialogTitle>
              <DialogDescription className="whitespace-pre-wrap break-words">
                {row.description}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Heading">{row.heading ?? "-"}</Field>
                <Field label="HS code">
                  {hsDisplay ? (
                    <HsCodeBadge code={hsDisplay} />
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </Field>
                <Field label="Tariff no.">
                  <span className="font-mono font-semibold">{row.tariffNo}</span>
                </Field>
                <Field label="Chapter">
                  {chapter ? (
                    <>
                      <span className="font-semibold">Chapter {chapter}</span>
                      {chapterTitle ? (
                        <span className="text-slate-600"> - {chapterTitle}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </Field>
                <Field label="Duty">{row.dutyRate ?? "-"}</Field>
                <Field label="Unit">{row.stdUnit ?? "-"}</Field>
              </div>

              <div className="space-y-4 border-t border-slate-100 pt-5">
                {!chapter ? (
                  <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                    No notes for this chapter
                  </p>
                ) : loading ? (
                  <p className="text-sm text-slate-500">Loading notes...</p>
                ) : state.error ? (
                  <div className="space-y-2">
                    <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {state.error}
                    </p>
                    <button
                      type="button"
                      className={secondaryBtn}
                      onClick={() => void load(chapter)}
                    >
                      Retry
                    </button>
                  </div>
                ) : !note ? (
                  <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                    No notes for this chapter
                  </p>
                ) : (
                  <>
                    {note.sectionNumber && (note.sectionNotes.trim() || editing) ? (
                      <div className="space-y-2">
                        <p className={labelClass}>
                          Section {note.sectionNumber} notes
                          {note.sectionTitle ? ` - ${note.sectionTitle}` : ""}
                        </p>
                        {editing ? (
                          <>
                            <textarea
                              value={draftSection}
                              onChange={(e) => setDraftSection(e.target.value)}
                              rows={8}
                              className={textareaClass}
                              disabled={saving}
                            />
                            <p className="text-xs text-slate-500">
                              Section notes are shared by every chapter in Section{" "}
                              {note.sectionNumber}.
                            </p>
                          </>
                        ) : (
                          <NotesText text={note.sectionNotes} />
                        )}
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <p className={labelClass}>Chapter {note.chapter} notes</p>
                      {editing ? (
                        <textarea
                          value={draftNotes}
                          onChange={(e) => setDraftNotes(e.target.value)}
                          rows={12}
                          className={textareaClass}
                          disabled={saving}
                        />
                      ) : note.notes.trim() ? (
                        <NotesText text={note.notes} />
                      ) : (
                        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                          No notes for this chapter
                        </p>
                      )}
                    </div>

                    {canEdit ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {editing ? (
                          <>
                            <button
                              type="button"
                              className={primaryBtn}
                              onClick={() => void onSave()}
                              disabled={saving}
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              className={secondaryBtn}
                              onClick={() => setEditing(false)}
                              disabled={saving}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={secondaryBtn}
                            onClick={startEdit}
                          >
                            Edit notes
                          </button>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}