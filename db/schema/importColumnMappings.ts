import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Remembered spreadsheet column mappings.
 * One row per tenant + document kind ("invoice" | "packing_list") + header
 * signature (order-independent hash of the normalized header names), so the same
 * file layout imports without asking again.
 */
export const importColumnMappings = pgTable(
  "import_column_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tenantId: varchar("tenant_id", { length: 30 }).notNull(),
    /** "invoice" | "packing_list" */
    documentType: varchar("document_type", { length: 30 }).notNull(),
    headerSignature: varchar("header_signature", { length: 64 }).notNull(),
    /** Normalized header keys at save time (for debugging / display). */
    headers: jsonb("headers").$type<string[]>(),
    /** SavedColumnMapping (header-based, see lib/import-cases/column-mapping.ts). */
    mapping: jsonb("mapping").notNull(),
    supplierName: text("supplier_name"),
    createdBy: uuid("created_by").references(() => users.id, {
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
    uqImportColumnMappings: uniqueIndex("uq_import_column_mappings_signature").on(
      table.tenantId,
      table.documentType,
      table.headerSignature,
    ),
    idxImportColumnMappingsTenant: index("idx_import_column_mappings_tenant").on(
      table.tenantId,
    ),
  }),
);

export type ImportColumnMappingRow = typeof importColumnMappings.$inferSelect;
export type ImportColumnMappingInsert = typeof importColumnMappings.$inferInsert;
