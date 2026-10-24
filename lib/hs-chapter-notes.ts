import "server-only";

import { db } from "@/db";
import { hsChapterNotes, type HsChapterNotesRow } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  normalizeChapter,
  type ChapterNotesDetail,
  type ChapterNotesSummary,
  type UpdateChapterNotesInput,
} from "./hs-chapter-notes-schema";
import {
  formatChapterNotesPromptBlock,
  type ChapterNotesPromptBlock,
} from "./hs-chapter-notes-prompt";

export {
  formatChapterNotesPromptBlock,
  PROMPT_CHAPTER_NOTES_CAP,
  PROMPT_MAX_CHAPTERS,
  PROMPT_SECTION_NOTES_CAP,
  type ChapterNotesPromptBlock,
} from "./hs-chapter-notes-prompt";

const CACHE_TTL_MS = 60 * 1000;
let cache: { rows: Map<string, HsChapterNotesRow>; loadedAt: number } | null =
  null;
let warnedMissingTable = false;

export function invalidateChapterNotesCache(): void {
  cache = null;
}

async function loadAll(): Promise<Map<string, HsChapterNotesRow>> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.rows;
  const rows = await db.select().from(hsChapterNotes);
  cache = {
    rows: new Map(rows.map((r) => [r.chapter, r])),
    loadedAt: Date.now(),
  };
  return cache.rows;
}

function toDetail(row: HsChapterNotesRow): ChapterNotesDetail {
  return {
    chapter: row.chapter,
    title: row.title,
    notes: row.notes,
    sectionNumber: row.sectionNumber,
    sectionTitle: row.sectionTitle,
    sectionNotes: row.sectionNotes,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

export async function getChapterNotes(
  chapter: string,
): Promise<ChapterNotesDetail | null> {
  const ch = normalizeChapter(chapter);
  if (!ch) return null;
  const [row] = await db
    .select()
    .from(hsChapterNotes)
    .where(eq(hsChapterNotes.chapter, ch))
    .limit(1);
  return row ? toDetail(row) : null;
}

/**
 * Notes for several chapters (order preserved, unknown chapters skipped).
 * Never throws: if the table is missing or the query fails, returns [] so
 * classification keeps working without notes.
 */
export async function getChapterNotesForChapters(
  chapters: string[],
): Promise<ChapterNotesDetail[]> {
  const wanted = [
    ...new Set(
      chapters.map((c) => normalizeChapter(c)).filter((c): c is string => !!c),
    ),
  ];
  if (wanted.length === 0) return [];
  try {
    const all = await loadAll();
    return wanted
      .map((c) => all.get(c))
      .filter((r): r is HsChapterNotesRow => !!r)
      .map(toDetail);
  } catch (error) {
    if (!warnedMissingTable) {
      warnedMissingTable = true;
      console.warn(
        "[hs-chapter-notes] could not load chapter notes (run `npm run db:migrate` and `npm run db:seed-notes`):",
        error instanceof Error ? error.message : error,
      );
    }
    return [];
  }
}

export async function listChapterNoteSummaries(): Promise<
  ChapterNotesSummary[]
> {
  const rows = await db.select().from(hsChapterNotes);
  return rows
    .map((r) => ({
      chapter: r.chapter,
      title: r.title,
      sectionNumber: r.sectionNumber,
      hasNotes: r.notes.trim().length > 0,
      hasSectionNotes: r.sectionNotes.trim().length > 0,
      edited: r.updatedBy !== null,
    }))
    .sort((a, b) => a.chapter.localeCompare(b.chapter));
}

export class ChapterNotesForbiddenError extends Error {
  constructor() {
    super("Admin access required");
  }
}

export class ChapterNotesNotFoundError extends Error {
  constructor(chapter: string) {
    super(`Chapter ${chapter} not found - run the chapter notes seed first`);
  }
}

/** Admin only. Callers must pass the signed-in user's id and role. */
export async function updateChapterNotes(
  actor: { id: string; role: string },
  input: UpdateChapterNotesInput,
): Promise<ChapterNotesDetail> {
  if (actor.role !== "admin") throw new ChapterNotesForbiddenError();

  const [existing] = await db
    .select()
    .from(hsChapterNotes)
    .where(eq(hsChapterNotes.chapter, input.chapter))
    .limit(1);
  if (!existing) throw new ChapterNotesNotFoundError(input.chapter);

  const now = new Date();
  const [updated] = await db
    .update(hsChapterNotes)
    .set({ notes: input.notes.trim(), updatedAt: now, updatedBy: actor.id })
    .where(eq(hsChapterNotes.chapter, input.chapter))
    .returning();

  if (
    input.sectionNotes !== undefined &&
    existing.sectionNumber &&
    input.sectionNotes.trim() !== existing.sectionNotes.trim()
  ) {
    await db
      .update(hsChapterNotes)
      .set({
        sectionNotes: input.sectionNotes.trim(),
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(eq(hsChapterNotes.sectionNumber, existing.sectionNumber));
  }

  invalidateChapterNotesCache();
  const fresh = await getChapterNotes(input.chapter);
  return fresh ?? toDetail(updated);
}

export async function buildChapterNotesPromptBlock(
  chapters: string[],
): Promise<ChapterNotesPromptBlock | null> {
  const details = await getChapterNotesForChapters(chapters);
  return formatChapterNotesPromptBlock(details);
}
