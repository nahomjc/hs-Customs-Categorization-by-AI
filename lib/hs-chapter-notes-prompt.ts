import type { ChapterNotesDetail } from "./hs-chapter-notes-schema";

/** Per-chapter cap for chapter notes injected in AI prompts. */
export const PROMPT_CHAPTER_NOTES_CAP = 6000;
/** Cap for each distinct section's notes injected in AI prompts. */
export const PROMPT_SECTION_NOTES_CAP = 3000;
export const PROMPT_MAX_CHAPTERS = 3;

function truncateAtLine(text: string, cap: number): string {
  if (text.length <= cap) return text;
  const cut = text.slice(0, cap);
  const lastBreak = cut.lastIndexOf("\n");
  const base = lastBreak > cap * 0.6 ? cut.slice(0, lastBreak) : cut;
  return `${base}\n[truncated]`;
}

export type ChapterNotesPromptBlock = {
  text: string;
  /** Chapters whose notes were included. */
  chapters: string[];
};

/**
 * Builds the "legal notes" block for the AI prompt: for each chapter (max 3)
 * the chapter notes, preceded once per section by that section's notes.
 * Returns null when none of the chapters has any notes (prompt unchanged).
 */
export function formatChapterNotesPromptBlock(
  details: ChapterNotesDetail[],
): ChapterNotesPromptBlock | null {
  const parts: string[] = [];
  const used: string[] = [];
  const seenSections = new Set<string>();

  for (const d of details.slice(0, PROMPT_MAX_CHAPTERS)) {
    const chapterNotes = d.notes.trim();
    const sectionNotes = d.sectionNotes.trim();
    const includeSection =
      sectionNotes.length > 0 &&
      (!d.sectionNumber || !seenSections.has(d.sectionNumber));
    if (!chapterNotes && !includeSection) continue;

    const lines: string[] = [];
    if (includeSection) {
      if (d.sectionNumber) seenSections.add(d.sectionNumber);
      lines.push(
        `Section ${d.sectionNumber ?? ""} Notes${d.sectionTitle ? ` (${d.sectionTitle})` : ""}:`,
        truncateAtLine(sectionNotes, PROMPT_SECTION_NOTES_CAP),
        "",
      );
    }
    lines.push(
      `Chapter ${d.chapter} Notes${d.title ? ` (${d.title})` : ""}:`,
      chapterNotes
        ? truncateAtLine(chapterNotes, PROMPT_CHAPTER_NOTES_CAP)
        : "(no chapter notes)",
    );
    parts.push(lines.join("\n"));
    used.push(d.chapter);
  }

  if (parts.length === 0) return null;
  return { text: parts.join("\n\n---\n\n"), chapters: used };
}

