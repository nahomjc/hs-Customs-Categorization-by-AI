import { z } from "zod";

/** Chapters 01-97 only (98/99 are national). */
export function normalizeChapter(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const digits = String(value).trim();
  if (!/^\d{1,2}$/.test(digits)) return null;
  const n = Number.parseInt(digits, 10);
  if (n < 1 || n > 97) return null;
  return String(n).padStart(2, "0");
}

/** Chapter 77 is "(Reserved for possible future use in the Harmonized System)". */
export function isReservedChapterTitle(title: string | null | undefined): boolean {
  return /^\(?\s*reserved\b/i.test((title ?? "").trim());
}

export const MAX_NOTES_LENGTH = 60_000;

export const updateChapterNotesSchema = z.object({
  chapter: z
    .string()
    .trim()
    .refine((v) => normalizeChapter(v) !== null, "Chapter must be 01-97")
    .transform((v) => normalizeChapter(v) as string),
  notes: z.string().max(MAX_NOTES_LENGTH, "Chapter notes are too long"),
  /**
   * Optional. Section notes are shared by every chapter of the section, so
   * saving them updates all chapters in that section.
   */
  sectionNotes: z
    .string()
    .max(MAX_NOTES_LENGTH, "Section notes are too long")
    .optional(),
});

export type UpdateChapterNotesInput = z.infer<typeof updateChapterNotesSchema>;

export type ChapterNotesSummary = {
  chapter: string;
  title: string;
  sectionNumber: string | null;
  hasNotes: boolean;
  hasSectionNotes: boolean;
  edited: boolean;
};

export type ChapterNotesDetail = {
  chapter: string;
  title: string;
  notes: string;
  sectionNumber: string | null;
  sectionTitle: string | null;
  sectionNotes: string;
  updatedAt: string;
  updatedBy: string | null;
};
