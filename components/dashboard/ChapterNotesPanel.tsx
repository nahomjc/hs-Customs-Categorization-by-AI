"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { dashInputClass } from "@/components/dashboard/ui";
import {
  isReservedChapterTitle,
  type ChapterNotesDetail,
  type ChapterNotesSummary,
} from "@/lib/hs-chapter-notes-schema";

// Flat styling on purpose (no shadows) - management pages use a flat UI.
const primaryBtn =
  "inline-flex items-center justify-center rounded-xl bg-[#007bff] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0069d9] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryBtn =
  "inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const textareaClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-gray-900 focus:border-[#007bff] focus:outline-none focus:ring-[3px] focus:ring-[#007bff]/12";

type DetailState = {
  loading: boolean;
  error: string | null;
  note: ChapterNotesDetail | null;
};

function NotesText({ text }: { text: string }) {
  return (
    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 font-sans text-sm leading-relaxed text-slate-700">
      {text}
    </pre>
  );
}

function ChapterRow({
  summary,
  canEdit,
  open,
  onToggle,
}: {
  summary: ChapterNotesSummary;
  canEdit: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const [detail, setDetail] = useState<DetailState>({
    loading: false,
    error: null,
    note: null,
  });
  const [editing, setEditing] = useState(false);
  const [draftNotes, setDraftNotes] = useState("");
  const [draftSection, setDraftSection] = useState("");
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(summary.edited);
  const [hasNotes, setHasNotes] = useState(summary.hasNotes);

  const load = useCallback(async () => {
    setDetail((d) => ({ ...d, loading: true, error: null }));
    try {
      const res = await fetch(
        `/api/dashboard/hs-reference/notes?chapter=${summary.chapter}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load notes");
      setDetail({ loading: false, error: null, note: data.note });
    } catch (e) {
      setDetail({
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load notes",
        note: null,
      });
    }
  }, [summary.chapter]);

  useEffect(() => {
    if (open && !detail.note && !detail.loading && !detail.error) {
      void load();
    }
  }, [open, detail.note, detail.loading, detail.error, load]);

  const startEdit = () => {
    if (!detail.note) return;
    setDraftNotes(detail.note.notes);
    setDraftSection(detail.note.sectionNotes);
    setEditing(true);
  };

  const onSave = async () => {
    if (!detail.note) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/hs-reference/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapter: summary.chapter,
          notes: draftNotes,
          ...(detail.note.sectionNumber
            ? { sectionNotes: draftSection }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save notes");
      setDetail({ loading: false, error: null, note: data.note });
      setHasNotes(data.note.notes.trim().length > 0);
      setEdited(true);
      setEditing(false);
      toast.success(`Chapter ${summary.chapter} notes saved`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  const note = detail.note;
  const reserved = isReservedChapterTitle(note?.title ?? summary.title);

  return (
    <li className="border-t border-slate-100 first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50 sm:px-6"
      >
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="w-24 shrink-0 text-sm font-bold tabular-nums text-slate-900">
          Chapter {summary.chapter}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
          {summary.title || "-"}
        </span>
        {summary.sectionNumber ? (
          <span className="hidden shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 sm:inline">
            Section {summary.sectionNumber}
          </span>
        ) : null}
        {edited ? (
          <span className="hidden shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 sm:inline">
            Edited
          </span>
        ) : null}
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            hasNotes
              ? "bg-blue-50 text-[#007bff]"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {hasNotes ? "Notes" : reserved ? "Reserved" : "No notes"}
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
          {detail.loading ? (
            <p className="text-sm text-slate-500">Loading notes...</p>
          ) : detail.error ? (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {detail.error}
            </p>
          ) : note ? (
            <>
              {note.sectionNumber && (note.sectionNotes.trim() || editing) ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
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
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Chapter {note.chapter} notes
                </p>
                {editing ? (
                  <textarea
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                    rows={14}
                    className={textareaClass}
                    disabled={saving}
                  />
                ) : note.notes.trim() ? (
                  <NotesText text={note.notes} />
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                    {reserved
                      ? "Reserved for possible future use in the Harmonized System. No notes."
                      : "No notes for this chapter"}
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
                    <button type="button" className={secondaryBtn} onClick={startEdit}>
                      Edit notes
                    </button>
                  )}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function ChapterNotesPanel() {
  const [summaries, setSummaries] = useState<ChapterNotesSummary[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openChapter, setOpenChapter] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/hs-reference/notes");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load notes");
        if (cancelled) return;
        setSummaries(data.notes ?? []);
        setCanEdit(Boolean(data.canEdit));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load notes");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter(
      (s) =>
        s.chapter.includes(q.replace(/^chapter\s*/, "")) ||
        s.title.toLowerCase().includes(q) ||
        (s.sectionNumber ?? "").toLowerCase() === q.replace(/^section\s*/, ""),
    );
  }, [summaries, query]);

  const withNotes = summaries.filter((s) => s.hasNotes).length;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-bold text-slate-900">Chapter &amp; section notes</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Official HS legal notes. Import classification reads these to apply
            each chapter&apos;s exclusions and inclusions.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600">
          {withNotes} of {summaries.length} chapters have notes
        </span>
      </div>

      <div className="space-y-3 px-5 py-4 sm:px-6">
        {error ? (
          <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a chapter by number, title or section (e.g. 04, dairy, XI)"
            className={`${dashInputClass} border-slate-200/80 bg-slate-50/50 focus:bg-white`}
          />
        </div>
        {!canEdit && !loading && !error ? (
          <p className="text-xs text-slate-500">Read-only: only admins can edit notes.</p>
        ) : null}
      </div>

      {loading ? (
        <p className="border-t border-slate-100 px-6 py-8 text-center text-sm text-slate-500">
          Loading chapter notes...
        </p>
      ) : !error && summaries.length === 0 ? (
        <p className="border-t border-slate-100 px-6 py-8 text-center text-sm text-slate-500">
          No chapter notes loaded yet. Run <code>npm run db:migrate</code> then{" "}
          <code>npm run db:seed-notes</code>.
        </p>
      ) : filtered.length === 0 && !error ? (
        <p className="border-t border-slate-100 px-6 py-8 text-center text-sm text-slate-500">
          No chapters match your search.
        </p>
      ) : (
        <ul className="border-t border-slate-100">
          {filtered.map((s) => (
            <ChapterRow
              key={s.chapter}
              summary={s}
              canEdit={canEdit}
              open={openChapter === s.chapter}
              onToggle={() =>
                setOpenChapter((cur) => (cur === s.chapter ? null : s.chapter))
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
