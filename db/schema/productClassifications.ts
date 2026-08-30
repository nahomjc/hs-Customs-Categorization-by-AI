import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { hsCodeCandidates } from "./hsCodeCandidates";
import { importProducts } from "./importProducts";
import { users } from "./users";

export const productClassifications = pgTable("product_classifications", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  productId: uuid("product_id")
    .references(() => importProducts.id, { onDelete: "cascade" })
    .notNull(),
  status: varchar("status", { length: 30 }).default("suggested").notNull(),
  hsCode: varchar("hs_code", { length: 20 }).notNull(),
  tariffVersion: varchar("tariff_version", { length: 50 }).notNull(),
  officialDescription: text("official_description").notNull(),
  classificationBasis: text("classification_basis"),
  source: varchar("source", { length: 30 }).default("ai_suggestion").notNull(),
  selectedCandidateId: uuid("selected_candidate_id").references(
    () => hsCodeCandidates.id,
    { onDelete: "set null" },
  ),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewerReason: text("reviewer_reason"),
  isFinal: boolean("is_final").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type ProductClassificationRow =
  typeof productClassifications.$inferSelect;
export type ProductClassificationInsert =
  typeof productClassifications.$inferInsert;
