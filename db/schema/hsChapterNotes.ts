import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Official HS Chapter notes plus the notes of the Section the chapter belongs to.
 * Used on the HS reference page and as legal context in import classification.
 * Seeded from db/data/chapter-notes.json; admins can edit rows afterwards
 * (edited rows have updated_by set and are never overwritten by the seed script).
 */
export const hsChapterNotes = pgTable("hs_chapter_notes", {
  /** Two-digit chapter number, e.g. "04". */
  chapter: varchar("chapter", { length: 2 }).primaryKey().notNull(),
  title: text("title").notNull().default(""),
  notes: text("notes").notNull().default(""),
  /** Roman numeral, e.g. "XI". Null for chapters outside the loaded sections. */
  sectionNumber: varchar("section_number", { length: 8 }),
  sectionTitle: text("section_title"),
  sectionNotes: text("section_notes").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  /** users.id of the admin who last edited the row; null = seeded data. */
  updatedBy: uuid("updated_by"),
});

export type HsChapterNotesRow = typeof hsChapterNotes.$inferSelect;
export type HsChapterNotesInsert = typeof hsChapterNotes.$inferInsert;
