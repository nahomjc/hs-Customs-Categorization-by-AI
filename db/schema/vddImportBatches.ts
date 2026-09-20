import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const vddImportBatches = pgTable(
  "vdd_import_batches",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tenantId: varchar("tenant_id", { length: 30 }).notNull(),
    sourceFileName: text("source_file_name").notNull(),
    sourceFileHash: varchar("source_file_hash", { length: 64 }),
    sourceType: varchar("source_type", { length: 20 }).default("xlsx").notNull(),
    sheetName: varchar("sheet_name", { length: 255 }),
    rowCount: integer("row_count"),
    validRowCount: integer("valid_row_count"),
    invalidRowCount: integer("invalid_row_count"),
    status: varchar("status", { length: 30 }).default("processing").notNull(),
    importedByUserId: uuid("imported_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    columnMappings: jsonb("column_mappings"),
    extraColumns: jsonb("extra_columns").default([]).notNull(),
    errorReport: jsonb("error_report"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    idxVddBatchesTenant: index("idx_vdd_import_batches_tenant").on(
      table.tenantId,
    ),
    idxVddBatchesStatus: index("idx_vdd_import_batches_status").on(
      table.status,
    ),
    idxVddBatchesCreated: index("idx_vdd_import_batches_created").on(
      table.createdAt,
    ),
  }),
);

export type VddImportBatchRow = typeof vddImportBatches.$inferSelect;
export type VddImportBatchInsert = typeof vddImportBatches.$inferInsert;
