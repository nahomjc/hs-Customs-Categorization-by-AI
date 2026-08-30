import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { importCaseDocuments } from "./importCaseDocuments";
import { importCases } from "./importCases";
import { users } from "./users";

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    importCaseId: uuid("import_case_id")
      .references(() => importCases.id, { onDelete: "cascade" })
      .notNull(),
    documentId: uuid("document_id")
      .references(() => importCaseDocuments.id, { onDelete: "cascade" })
      .notNull(),
    lineNumber: integer("line_number").notNull(),
    supplierDescription: text("supplier_description").notNull(),
    supplierSku: varchar("supplier_sku", { length: 100 }),
    brand: varchar("brand", { length: 100 }),
    modelNumber: varchar("model_number", { length: 100 }),
    quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull(),
    unitOfMeasure: varchar("unit_of_measure", { length: 30 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 18, scale: 4 }),
    lineTotalAmount: numeric("line_total_amount", { precision: 18, scale: 2 }),
    currencyCode: varchar("currency_code", { length: 3 }).notNull(),
    countryOfOriginCode: varchar("country_of_origin_code", { length: 3 }),
    declaredNetWeightKg: numeric("declared_net_weight_kg", {
      precision: 18,
      scale: 3,
    }),
    declaredGrossWeightKg: numeric("declared_gross_weight_kg", {
      precision: 18,
      scale: 3,
    }),
    extractionConfidence: numeric("extraction_confidence", {
      precision: 5,
      scale: 4,
    }),
    isReviewed: boolean("is_reviewed").default(false).notNull(),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    documentLineUnique: unique("invoice_lines_document_line_unique").on(
      table.documentId,
      table.lineNumber,
    ),
    idxInvoiceLinesCase: index("idx_invoice_lines_case").on(table.importCaseId),
    idxInvoiceLinesDocument: index("idx_invoice_lines_document").on(
      table.documentId,
    ),
  }),
);

export type InvoiceLineRow = typeof invoiceLines.$inferSelect;
export type InvoiceLineInsert = typeof invoiceLines.$inferInsert;
