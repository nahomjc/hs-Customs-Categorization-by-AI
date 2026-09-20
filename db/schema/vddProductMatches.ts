import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { importProducts } from "./importProducts";
import { vddReferenceRecords } from "./vddReferenceRecords";

export const vddProductMatches = pgTable(
  "vdd_product_matches",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id")
      .references(() => importProducts.id, { onDelete: "cascade" })
      .notNull(),
    vddReferenceRecordId: uuid("vdd_reference_record_id")
      .references(() => vddReferenceRecords.id, { onDelete: "cascade" })
      .notNull(),
    similarityScore: numeric("similarity_score", {
      precision: 5,
      scale: 4,
    }).notNull(),
    matchReasons: jsonb("match_reasons").default([]).notNull(),
    differences: jsonb("differences").default([]).notNull(),
    hsCodeMatches: boolean("hs_code_matches"),
    priceComparison: jsonb("price_comparison"),
    isUsedAsEvidence: boolean("is_used_as_evidence").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    productVddUnique: unique("vdd_product_matches_product_vdd_unique").on(
      table.productId,
      table.vddReferenceRecordId,
    ),
    idxVddProductMatchesProduct: index("idx_vdd_product_matches_product").on(
      table.productId,
    ),
    idxVddProductMatchesScore: index("idx_vdd_product_matches_score").on(
      table.similarityScore,
    ),
  }),
);

export type VddProductMatchRow = typeof vddProductMatches.$inferSelect;
export type VddProductMatchInsert = typeof vddProductMatches.$inferInsert;
