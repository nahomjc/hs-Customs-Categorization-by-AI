import {
  boolean,
  numeric,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { importProducts } from "./importProducts";
import { invoiceLines } from "./invoiceLines";

export const productInvoiceLines = pgTable(
  "product_invoice_lines",
  {
    productId: uuid("product_id")
      .references(() => importProducts.id, { onDelete: "cascade" })
      .notNull(),
    invoiceLineId: uuid("invoice_line_id")
      .references(() => invoiceLines.id, { onDelete: "cascade" })
      .notNull(),
    matchConfidence: numeric("match_confidence", { precision: 5, scale: 4 }),
    isConfirmed: boolean("is_confirmed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.productId, table.invoiceLineId] }),
  }),
);

export type ProductInvoiceLineRow = typeof productInvoiceLines.$inferSelect;
export type ProductInvoiceLineInsert = typeof productInvoiceLines.$inferInsert;
