import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const hsCodeReference = pgTable(
  "hs_code_reference",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    heading: varchar("heading", { length: 20 }),
    hsCode: varchar("hs_code", { length: 20 }),
    tariffNo: varchar("tariff_no", { length: 20 }).notNull(),
    description: text("description").notNull(),
    stdUnit: varchar("std_unit", { length: 30 }),
    dutyRate: varchar("duty_rate", { length: 30 }),
    chapter: varchar("chapter", { length: 2 }),
    normalizedHs: varchar("normalized_hs", { length: 20 }),
    importedAt: timestamp("imported_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tariffNoUnique: unique("hs_code_reference_tariff_no_unique").on(
      table.tariffNo,
    ),
    idxHsRefHsCode: index("idx_hs_ref_hs_code").on(table.hsCode),
    idxHsRefNormalizedHs: index("idx_hs_ref_normalized_hs").on(
      table.normalizedHs,
    ),
    idxHsRefChapter: index("idx_hs_ref_chapter").on(table.chapter),
  }),
);

export type HsCodeReferenceRow = typeof hsCodeReference.$inferSelect;
export type HsCodeReferenceInsert = typeof hsCodeReference.$inferInsert;
