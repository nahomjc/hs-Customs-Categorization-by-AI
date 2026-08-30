import {
  boolean,
  numeric,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { importProducts } from "./importProducts";
import { packingListLines } from "./packingListLines";

export const productPackingListLines = pgTable(
  "product_packing_list_lines",
  {
    productId: uuid("product_id")
      .references(() => importProducts.id, { onDelete: "cascade" })
      .notNull(),
    packingListLineId: uuid("packing_list_line_id")
      .references(() => packingListLines.id, { onDelete: "cascade" })
      .notNull(),
    matchConfidence: numeric("match_confidence", { precision: 5, scale: 4 }),
    isConfirmed: boolean("is_confirmed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.productId, table.packingListLineId] }),
  }),
);

export type ProductPackingListLineRow =
  typeof productPackingListLines.$inferSelect;
export type ProductPackingListLineInsert =
  typeof productPackingListLines.$inferInsert;
