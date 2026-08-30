import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { importCases } from "./importCases";
import { users } from "./users";

export const productGroupings = pgTable(
  "product_groupings",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    importCaseId: uuid("import_case_id")
      .references(() => importCases.id, { onDelete: "cascade" })
      .notNull(),
    groupCode: varchar("group_code", { length: 50 }).notNull(),
    status: varchar("status", { length: 40 }).default("not_checked").notNull(),
    hsCode: varchar("hs_code", { length: 20 }),
    countryOfOriginCode: varchar("country_of_origin_code", { length: 3 }),
    procedureCode: varchar("procedure_code", { length: 50 }),
    taxProfileHash: varchar("tax_profile_hash", { length: 128 }),
    unitOfMeasure: varchar("unit_of_measure", { length: 30 }),
    groupingReason: text("grouping_reason"),
    cannotGroupReason: text("cannot_group_reason"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    caseGroupCodeUnique: unique("product_groupings_case_group_code_unique").on(
      table.importCaseId,
      table.groupCode,
    ),
    idxProductGroupingsCase: index("idx_product_groupings_case").on(
      table.importCaseId,
    ),
    idxProductGroupingsStatus: index("idx_product_groupings_status").on(
      table.status,
    ),
  }),
);

export type ProductGroupingRow = typeof productGroupings.$inferSelect;
export type ProductGroupingInsert = typeof productGroupings.$inferInsert;
