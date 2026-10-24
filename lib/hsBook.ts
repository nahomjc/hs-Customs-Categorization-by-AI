import "server-only";

import { db } from "@/db";
import {
  hsChapterNotes,
  hsCodeReference,
  type HsCodeReferenceRow,
} from "@/db/schema";
import { asc, inArray, sql } from "drizzle-orm";
import { normalizeChapter } from "./hs-chapter-notes-schema";
import {
  HS_STANDARD_CHAPTER_TITLES,
  HS_STANDARD_SECTIONS,
  standardSectionForChapter,
  type HsBookChapter,
  type HsBookChapterData,
  type HsBookHeading,
  type HsBookLine,
  type HsBookSection,
  type HsBookSkeleton,
} from "./hsBookTypes";

const MAX_CHAPTER_ROWS = 5000;

function digitsOf(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Four-digit heading key for a reference row, or null if it cannot be derived. */
function headingKeyOf(row: HsCodeReferenceRow): string | null {
  for (const src of [row.normalizedHs, row.hsCode]) {
    const d = digitsOf(src);
    if (d.length >= 4) return d.slice(0, 4);
  }
  const fromHeading = digitsOf(row.heading);
  if (fromHeading.length === 4) return fromHeading;
  const fromTariff = digitsOf(row.tariffNo);
  if (fromTariff.length >= 4) return fromTariff.slice(0, 4);
  return null;
}

/** Digit count of the row's own HS code (4 = heading row, 6 = subheading, 8+ = national line). */
function codeLengthOf(row: HsCodeReferenceRow): number {
  const d = digitsOf(row.normalizedHs ?? row.hsCode);
  return d.length > 0 ? d.length : digitsOf(row.tariffNo).length;
}

const LEADING_DASHES = /^(?:\s*-)+/;

function stripDashes(text: string): { text: string; depth: number } {
  const m = text.match(LEADING_DASHES);
  const depth = m ? (m[0].match(/-/g) ?? []).length : 0;
  return {
    text: text.replace(LEADING_DASHES, "").replace(/\s+/g, " ").trim(),
    depth: Math.min(depth, 4),
  };
}

function formatHeadingCode(key: string): string {
  return `${key.slice(0, 2)}.${key.slice(2)}`;
}

/** Group a chapter's reference rows into headings (pure, exported for tests). */
export function groupRowsIntoHeadings(
  rows: HsCodeReferenceRow[],
): HsBookHeading[] {
  const buckets = new Map<
    string,
    { titleRow: HsCodeReferenceRow | null; rows: HsCodeReferenceRow[] }
  >();

  for (const row of rows) {
    const key = headingKeyOf(row);
    if (!key) continue;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { titleRow: null, rows: [] };
      buckets.set(key, bucket);
    }
    if (codeLengthOf(row) <= 4 && !bucket.titleRow) {
      bucket.titleRow = row;
    } else {
      bucket.rows.push(row);
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucket]) => {
      const sorted = [...bucket.rows].sort((a, b) =>
        a.tariffNo.localeCompare(b.tariffNo, undefined, { numeric: true }),
      );
      const lines: HsBookLine[] = sorted.map((r) => {
        const { text, depth } = stripDashes(r.description);
        return {
          id: r.id,
          heading: r.heading,
          hsCode: r.hsCode,
          normalizedHs: r.normalizedHs,
          tariffNo: r.tariffNo,
          description: text || r.description,
          stdUnit: r.stdUnit,
          dutyRate: r.dutyRate,
          chapter: r.chapter,
          depth,
        };
      });

      let title: string | null = null;
      let titleDerived = false;
      if (bucket.titleRow) {
        title = stripDashes(bucket.titleRow.description).text || null;
      } else if (lines.length > 0) {
        title = lines[0].description || null;
        titleDerived = title !== null;
      }

      return {
        key,
        code: formatHeadingCode(key),
        title,
        titleDerived,
        lineCount: lines.length,
        lines,
      };
    });
}

/** Tariff lines of one chapter, grouped by heading. */
export async function getChapterBookData(
  chapterParam: string,
): Promise<HsBookChapterData | null> {
  const chapter = normalizeChapter(chapterParam);
  if (!chapter) return null;

  const variants = [chapter, String(Number.parseInt(chapter, 10))];
  const rows = await db
    .select()
    .from(hsCodeReference)
    .where(inArray(hsCodeReference.chapter, variants))
    .orderBy(asc(hsCodeReference.tariffNo))
    .limit(MAX_CHAPTER_ROWS);

  return {
    chapter,
    rowCount: rows.length,
    headings: groupRowsIntoHeadings(rows),
  };
}

type NoteMeta = {
  chapter: string;
  title: string;
  sectionNumber: string | null;
  sectionTitle: string | null;
  hasNotes: boolean;
};

async function loadNoteMeta(): Promise<NoteMeta[] | null> {
  try {
    const rows = await db
      .select({
        chapter: hsChapterNotes.chapter,
        title: hsChapterNotes.title,
        sectionNumber: hsChapterNotes.sectionNumber,
        sectionTitle: hsChapterNotes.sectionTitle,
        hasNotes: sql<boolean>`length(trim(${hsChapterNotes.notes})) > 0`,
      })
      .from(hsChapterNotes);
    return rows;
  } catch (error) {
    console.warn(
      "[hs-book] could not read hs_chapter_notes (using standard titles):",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function loadChapterCounts(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      chapter: hsCodeReference.chapter,
      count: sql<number>`count(*)::int`,
    })
    .from(hsCodeReference)
    .groupBy(hsCodeReference.chapter);
  const counts = new Map<string, number>();
  for (const r of rows) {
    const ch = normalizeChapter(r.chapter);
    if (!ch) continue;
    counts.set(ch, (counts.get(ch) ?? 0) + Number(r.count));
  }
  return counts;
}

/**
 * Section > chapter tree for chapters 01-97 (no tariff lines).
 * Titles and the chapter->section mapping come from hs_chapter_notes; gaps
 * (any chapter whose title is missing) are filled from standard HS nomenclature.
 */
export async function getBookSkeleton(): Promise<HsBookSkeleton> {
  const [notes, counts] = await Promise.all([loadNoteMeta(), loadChapterCounts()]);
  const noteByChapter = new Map<string, NoteMeta>(
    (notes ?? []).map((n) => [n.chapter, n]),
  );

  const sectionTitleFromData = new Map<string, string>();
  for (const n of notes ?? []) {
    if (n.sectionNumber && n.sectionTitle?.trim()) {
      sectionTitleFromData.set(n.sectionNumber, n.sectionTitle.trim());
    }
  }

  const sections = new Map<string, HsBookSection>();
  const order = HS_STANDARD_SECTIONS.map((s) => s.number);

  for (let i = 1; i <= 97; i++) {
    const chapter = String(i).padStart(2, "0");
    const note = noteByChapter.get(chapter);
    const standard = standardSectionForChapter(chapter);
    const sectionNumber = note?.sectionNumber || standard?.number;
    if (!sectionNumber) continue;

    let section = sections.get(sectionNumber);
    if (!section) {
      section = {
        number: sectionNumber,
        title:
          sectionTitleFromData.get(sectionNumber) ??
          HS_STANDARD_SECTIONS.find((s) => s.number === sectionNumber)?.title ??
          `Section ${sectionNumber}`,
        chapters: [],
      };
      sections.set(sectionNumber, section);
    }

    const chapterEntry: HsBookChapter = {
      chapter,
      title:
        note?.title?.trim() ||
        HS_STANDARD_CHAPTER_TITLES[String(i)] ||
        `Chapter ${chapter}`,
      rowCount: counts.get(chapter) ?? 0,
      hasNotes: note?.hasNotes ?? false,
    };
    section.chapters.push(chapterEntry);
  }

  const ordered = [...sections.values()].sort(
    (a, b) => order.indexOf(a.number) - order.indexOf(b.number),
  );

  return {
    sections: ordered,
    chapterCount: ordered.reduce((n, s) => n + s.chapters.length, 0),
    notesUnavailable: notes === null,
  };
}