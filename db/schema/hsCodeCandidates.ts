import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { importProducts } from "./importProducts";

export const hsCodeCandidates = pgTable(
  "hs_code_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id")
      .references(() => importProducts.id, { onDelete: "cascade" })
      .notNull(),
    tariffVersion: varchar("tariff_version", { length: 50 })
      .notNull()
      .default("ETH-2024"),
    hsCode: varchar("hs_code", { length: 20 }).notNull(),
    officialDescription: text("official_description").notNull(),
    rank: integer("rank").notNull(),
    confidenceScore: numeric("confidence_score", {
      precision: 5,
      scale: 4,
    }).notNull(),
    confidenceLevel: varchar("confidence_level", { length: 10 }).notNull(),
    reasoning: text("reasoning").notNull(),
    classificationEvidence: jsonb("classification_evidence"),
    missingInformation: jsonb("missing_information").default([]).notNull(),
    aiModelName: varchar("ai_model_name", { length: 100 }),
    promptVersion: varchar("prompt_version", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    productRankUnique: unique("hs_code_candidates_product_rank_unique").on(
      table.productId,
      table.rank,
    ),
    idxHsCodeCandidatesProduct: index("idx_hs_code_candidates_product").on(
      table.productId,
    ),
    idxHsCodeCandidatesHsCode: index("idx_hs_code_candidates_hs_code").on(
      table.hsCode,
    ),
  }),
);

export type HsCodeCandidateRow = typeof hsCodeCandidates.$inferSelect;
export type HsCodeCandidateInsert = typeof hsCodeCandidates.$inferInsert;
