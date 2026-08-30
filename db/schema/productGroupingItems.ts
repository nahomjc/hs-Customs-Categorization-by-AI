import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { importProducts } from "./importProducts";
import { productGroupings } from "./productGroupings";

export const productGroupingItems = pgTable(
  "product_grouping_items",
  {
    groupingId: uuid("grouping_id")
      .references(() => productGroupings.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => importProducts.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.groupingId, table.productId] }),
  }),
);

export type ProductGroupingItemRow = typeof productGroupingItems.$inferSelect;
export type ProductGroupingItemInsert = typeof productGroupingItems.$inferInsert;
