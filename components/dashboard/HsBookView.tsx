"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HsCodeDetailRow } from "@/components/dashboard/HsCodeDetailDialog";
import { dashInputClass } from "@/components/dashboard/ui";
import type {
  HsBookChapter,
  HsBookChapterData,
  HsBookHeading,
  HsBookLine,
  HsBookSection,
  HsBookSkeleton,
} from "@/lib/hsBookTypes";

// Flat styling on purpose (no shadows).

type ChapterState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: HsBookChapterData };

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
        open ? "rotate-90" : ""
      }`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#007bff]/40";

const detailBtn =
  "shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007bff]/40";

function chapterRow(chapter: HsBookChapter): HsCodeDetailRow {
  return {
    heading: null,
    hsCode: null,
    normalizedHs: null,
    tariffNo: `Chapter ${chapter.chapter}`,
    description: chapter.title,
    stdUnit: null,
    dutyRate: null,
    chapter: chapter.chapter,
  };
}

function headingRow(
  chapter: string,
  heading: HsBookHeading,
): HsCodeDetailRow {
  return {
    heading: heading.code,
    hsCode: heading.key,
    normalizedHs: heading.key,
    tariffNo: heading.code,
    description: heading.title ?? "(no heading title)",
    stdUnit: null,
    dutyRate: null,
    chapter,
  };
}

function HeadingNode({
  chapter,
  heading,
  open,
  onToggle,
  onOpenRow,
}: {
  chapter: string;
  heading: HsBookHeading;
  open: boolean;
  onToggle: () => void;
  onOpenRow: (row: HsCodeDetailRow) => void;
}) {
  const panelId = `hs-book-heading-${heading.key}`;
  return (
    <li>
      <div className="flex items-center gap-2 pr-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className={`flex min-w-0 flex-1 items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50 ${focusRing}`}
        >
          <span className="mt-0.5">
            <Chevron open={open} />
          </span>
          <span className="shrink-0 font-mono text-sm font-semibold text-slate-800">
            {heading.code}
          </span>
          <span
            className={`min-w-0 flex-1 text-sm leading-snug ${
              heading.title && !heading.titleDerived
                ? "text-slate-700"
                : "italic text-slate-500"
            }`}
          >
            {heading.title ?? "(no heading title)"}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-slate-400">
            {heading.lineCount} {heading.lineCount === 1 ? "line" : "lines"}
          </span>
        </button>
        <button
          type="button"
          className={detailBtn}
          onClick={() => onOpenRow(headingRow(chapter, heading))}
          aria-label={`Open details for heading ${heading.code}`}
        >
          Details
        </button>
      </div>
      {open ? (
        <ul id={panelId} className="mb-1 ml-5 border-l border-slate-100">
          {heading.lines.length === 0 ? (
            <li className="px-4 py-2 text-sm text-slate-500">
              No tariff lines under this heading.
            </li>
          ) : (
            heading.lines.map((line) => (
              <LineNode key={line.id} line={line} onOpenRow={onOpenRow} />
            ))
          )}
        </ul>
      ) : null}
    </li>
  );
}

function LineNode({
  line,
  onOpenRow,
}: {
  line: HsBookLine;
  onOpenRow: (row: HsCodeDetailRow) => void;
}) {
  const code = line.hsCode ?? line.normalizedHs ?? line.tariffNo;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpenRow(line)}
        aria-label={`View details for ${line.tariffNo}`}
        className={`flex w-full items-start gap-3 rounded-lg px-3 py-1.5 text-left hover:bg-blue-50/50 ${focusRing}`}
        style={{ paddingLeft: `${12 + line.depth * 16}px` }}
      >
        <span className="w-28 shrink-0 font-mono text-xs font-semibold text-slate-800">
          {code}
        </span>
        <span className="min-w-0 flex-1 text-sm leading-snug text-slate-700">
          {line.description}
        </span>
        {line.dutyRate ? (
          <span className="shrink-0 rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
            {line.dutyRate}
          </span>
        ) : null}
        {line.stdUnit ? (
          <span className="w-12 shrink-0 text-right text-xs text-slate-500">
            {line.stdUnit}
          </span>
        ) : null}
      </button>
    </li>
  );
}

export function HsBookView({
  refreshKey,
  onOpenRow,
}: {
  /** Changes when the tariff data is re-imported; clears the loaded chapters. */
  refreshKey: string | null;
  onOpenRow: (row: HsCodeDetailRow) => void;
}) {
  const [skeleton, setSkeleton] = useState<HsBookSkeleton | null>(null);
  const [skeletonError, setSkeletonError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());
  const [openHeadings, setOpenHeadings] = useState<Set<string>>(new Set());
  const [chapterStates, setChapterStates] = useState<
    Record<string, ChapterState>
  >({});
  const cacheRef = useRef(new Map<string, HsBookChapterData>());
  const inFlightRef = useRef(new Set<string>());

  const loadSkeleton = useCallback(async () => {
    setSkeletonError(null);
    try {
      const res = await fetch("/api/dashboard/hs-reference/book");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load book view");
      setSkeleton(data as HsBookSkeleton);
    } catch (e) {
      setSkeletonError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    // Tariff data changed (or first mount): drop cached chapters and reload.
    cacheRef.current.clear();
    inFlightRef.current.clear();
    void loadSkeleton();
    return () => {
      setChapterStates({});
      setOpenChapters(new Set());
      setOpenHeadings(new Set());
    };
  }, [refreshKey, loadSkeleton]);

  const loadChapter = useCallback(async (chapter: string, force = false) => {
    if (inFlightRef.current.has(chapter)) return;
    if (!force && cacheRef.current.has(chapter)) return;
    inFlightRef.current.add(chapter);
    setChapterStates((prev) => ({ ...prev, [chapter]: { status: "loading" } }));
    try {
      const res = await fetch(
        `/api/dashboard/hs-reference/book?chapter=${chapter}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load chapter");
      const chapterData = data as HsBookChapterData;
      cacheRef.current.set(chapter, chapterData);
      setChapterStates((prev) => ({
        ...prev,
        [chapter]: { status: "ready", data: chapterData },
      }));
    } catch (e) {
      setChapterStates((prev) => ({
        ...prev,
        [chapter]: {
          status: "error",
          message: e instanceof Error ? e.message : "Failed to load chapter",
        },
      }));
    } finally {
      inFlightRef.current.delete(chapter);
    }
  }, []);

  const toggleIn = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    key: string,
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleChapter = (chapter: string) => {
    const opening = !openChapters.has(chapter);
    toggleIn(setOpenChapters, chapter);
    if (opening) void loadChapter(chapter);
  };

  const query = filter.trim().toLowerCase();

  const visibleSections = useMemo(() => {
    if (!skeleton) return [];
    if (!query) return skeleton.sections;
    const out: HsBookSection[] = [];
    for (const section of skeleton.sections) {
      const sectionHit = section.title.toLowerCase().includes(query);
      const chapters = sectionHit
        ? section.chapters
        : section.chapters.filter(
            (c) =>
              c.chapter.includes(query) ||
              String(Number.parseInt(c.chapter, 10)) === query ||
              c.title.toLowerCase().includes(query),
          );
      if (chapters.length > 0) out.push({ ...section, chapters });
    }
    return out;
  }, [skeleton, query]);

  if (skeletonError) {
    return (
      <div className="space-y-3 px-5 py-6 sm:px-6">
        <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {skeletonError}
        </p>
        <button
          type="button"
          className={detailBtn}
          onClick={() => void loadSkeleton()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!skeleton) {
    return (
      <p className="px-5 py-8 text-center text-sm text-slate-500 sm:px-6">
        Loading book view...
      </p>
    );
  }

  return (
    <div className="space-y-4 px-5 py-4 sm:px-6">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter chapters by number or title..."
          aria-label="Filter chapters by number or title"
          className={`${dashInputClass} border-slate-200/80 bg-slate-50/50 focus:bg-white`}
        />
      </div>

      {skeleton.notesUnavailable ? (
        <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Chapter notes are not loaded, so standard HS section and chapter
          titles are shown. Run <code>npm run db:migrate</code> and{" "}
          <code>npm run db:seed-notes</code> to load them.
        </p>
      ) : null}

      {visibleSections.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          No chapters match your filter.
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleSections.map((section) => {
            const sectionOpen = !!query || openSections.has(section.number);
            const sectionPanelId = `hs-book-section-${section.number}`;
            return (
              <li
                key={section.number}
                className="rounded-2xl border border-slate-200/70 bg-white"
              >
                <button
                  type="button"
                  onClick={() => toggleIn(setOpenSections, section.number)}
                  aria-expanded={sectionOpen}
                  aria-controls={sectionPanelId}
                  className={`flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left hover:bg-slate-50 ${focusRing}`}
                >
                  <span className="mt-0.5">
                    <Chevron open={sectionOpen} />
                  </span>
                  <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                    Section {section.number}
                  </span>
                  <span
                    className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-900"
                    title={section.title}
                  >
                    {section.title}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-400">
                    {section.chapters.length}{" "}
                    {section.chapters.length === 1 ? "chapter" : "chapters"}
                  </span>
                </button>

                {sectionOpen ? (
                  <ul
                    id={sectionPanelId}
                    className="border-t border-slate-100 py-1"
                  >
                    {section.chapters.map((chapter) => {
                      const chapterOpen = openChapters.has(chapter.chapter);
                      const state = chapterStates[chapter.chapter];
                      const chapterPanelId = `hs-book-chapter-${chapter.chapter}`;
                      return (
                        <li key={chapter.chapter}>
                          <div className="flex items-center gap-2 pr-3">
                            <button
                              type="button"
                              onClick={() => toggleChapter(chapter.chapter)}
                              aria-expanded={chapterOpen}
                              aria-controls={chapterPanelId}
                              className={`flex min-w-0 flex-1 items-start gap-2 rounded-lg px-4 py-2 text-left hover:bg-slate-50 ${focusRing}`}
                            >
                              <span className="mt-0.5">
                                <Chevron open={chapterOpen} />
                              </span>
                              <span className="shrink-0 text-sm font-bold text-slate-800">
                                Chapter {chapter.chapter}
                              </span>
                              <span className="min-w-0 flex-1 text-sm leading-snug text-slate-700">
                                {chapter.title}
                              </span>
                              <span className="shrink-0 text-xs tabular-nums text-slate-400">
                                {chapter.rowCount.toLocaleString()} rows
                              </span>
                            </button>
                            <button
                              type="button"
                              className={detailBtn}
                              onClick={() => onOpenRow(chapterRow(chapter))}
                              aria-label={`Open notes for chapter ${chapter.chapter}`}
                            >
                              Notes
                            </button>
                          </div>

                          {chapterOpen ? (
                            <div id={chapterPanelId} className="pb-2 pl-6">
                              {!state || state.status === "loading" ? (
                                <p className="px-4 py-2 text-sm text-slate-500">
                                  Loading headings...
                                </p>
                              ) : state.status === "error" ? (
                                <div className="flex flex-wrap items-center gap-3 px-4 py-2">
                                  <p className="text-sm text-red-700">
                                    {state.message}
                                  </p>
                                  <button
                                    type="button"
                                    className={detailBtn}
                                    onClick={() =>
                                      void loadChapter(chapter.chapter, true)
                                    }
                                  >
                                    Retry
                                  </button>
                                </div>
                              ) : state.data.headings.length === 0 ? (
                                <p className="px-4 py-2 text-sm text-slate-500">
                                  No tariff lines are loaded for this chapter.
                                </p>
                              ) : (
                                <ul>
                                  {state.data.headings.map((heading) => {
                                    const hKey = `${chapter.chapter}:${heading.key}`;
                                    return (
                                      <HeadingNode
                                        key={heading.key}
                                        chapter={chapter.chapter}
                                        heading={heading}
                                        open={openHeadings.has(hKey)}
                                        onToggle={() =>
                                          toggleIn(setOpenHeadings, hKey)
                                        }
                                        onOpenRow={onOpenRow}
                                      />
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}