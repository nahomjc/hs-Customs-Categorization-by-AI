/**
 * Real (database-backed) inputs for the web-search step: tariff-book rows and
 * legal chapter notes. Kept apart from hs-web-step.ts so that step stays
 * testable offline.
 */

import { buildChapterNotesPromptBlock } from "@/lib/hs-chapter-notes";
import { normalizeChapter } from "@/lib/hs-chapter-notes-schema";
import { formatReferenceCandidate, searchDescriptions } from "@/lib/hsReference";
import { isReferencePopulated } from "@/lib/hsReferenceCache";
import type { StepDeps } from "./hs-web-step";

const MAX_NOTE_CHAPTERS = 3;

function chapterFromHint(hint: string): string | null {
  const m = hint.trim().match(/^(\d{2})/);
  if (!m) return null;
  const chapter = normalizeChapter(m[1]);
  // 98 / 99 are national or special-use chapters, not product chapters
  return chapter && chapter !== "98" && chapter !== "99" ? chapter : null;
}

export function createStepDeps(): Pick<StepDeps, "getCandidates" | "getNotes"> {
  return {
    async getCandidates(query) {
      if (!isReferencePopulated()) return [];
      const rows = await searchDescriptions(query, 20);
      return rows.map((row) => formatReferenceCandidate(row));
    },
    async getNotes(hints) {
      const counts = new Map<string, number>();
      hints.forEach((hint, i) => {
        const chapter = chapterFromHint(hint);
        if (chapter) counts.set(chapter, (counts.get(chapter) ?? 0) + Math.max(1, 10 - i));
      });
      const chapters = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_NOTE_CHAPTERS)
        .map(([chapter]) => chapter);
      if (chapters.length === 0) return null;
      const block = await buildChapterNotesPromptBlock(chapters);
      return block?.text ? { text: block.text, chapters: block.chapters } : null;
    },
  };
}