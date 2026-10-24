/**
 * Seeds hs_chapter_notes from db/data/chapter-notes.json.
 *
 * - Inserts missing chapters.
 * - Updates existing rows ONLY when updated_by is null (never edited by an admin),
 *   so admin edits made on the HS reference page are never overwritten.
 *
 * Prerequisite: migration applied (npm run db:migrate).
 * Run: npm run db:seed-notes
 */

import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";
import { isNull, sql } from "drizzle-orm";

config({ path: resolve(process.cwd(), ".env") });

type SeedRow = {
  chapter: string;
  title: string;
  notes: string;
  section_number: string | null;
  section_title: string | null;
  section_notes: string;
};

async function main() {
  const { db } = await import("../db");
  const { hsChapterNotes } = await import("../db/schema");

  const file = resolve(process.cwd(), "db/data/chapter-notes.json");
  const rows = JSON.parse(readFileSync(file, "utf8")) as SeedRow[];

  let touched = 0;
  for (const r of rows) {
    const values = {
      chapter: r.chapter,
      title: r.title ?? "",
      notes: r.notes ?? "",
      sectionNumber: r.section_number,
      sectionTitle: r.section_title,
      sectionNotes: r.section_notes ?? "",
    };
    const result = await db
      .insert(hsChapterNotes)
      .values(values)
      .onConflictDoUpdate({
        target: hsChapterNotes.chapter,
        set: {
          title: values.title,
          notes: values.notes,
          sectionNumber: values.sectionNumber,
          sectionTitle: values.sectionTitle,
          sectionNotes: values.sectionNotes,
          updatedAt: sql`now()`,
        },
        setWhere: isNull(hsChapterNotes.updatedBy),
      })
      .returning({ chapter: hsChapterNotes.chapter });
    touched += result.length;
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(hsChapterNotes);
  const withNotes = rows.filter((r) => r.notes.trim().length > 0).length;
  console.log(
    `Chapter notes seed: ${rows.length} rows in file (${withNotes} with notes), ${touched} inserted/updated, ${rows.length - touched} skipped because an admin edited them, ${count} rows in table.`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("Chapter notes seed failed:", error);
  process.exit(1);
});
