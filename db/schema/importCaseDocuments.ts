import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { importCases } from "./importCases";
import { users } from "./users";

export const importCaseDocuments = pgTable(
  "import_case_documents",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    importCaseId: uuid("import_case_id")
      .references(() => importCases.id, { onDelete: "cascade" })
      .notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .references(() => users.id, { onDelete: "set null" })
      .notNull(),
    documentType: varchar("document_type", { length: 50 }).notNull(),
    status: varchar("status", { length: 30 }).default("uploaded").notNull(),
    originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: varchar("mime_type", { length: 100 }),
    fileSizeBytes: integer("file_size_bytes"),
    fileHash: varchar("file_hash", { length: 128 }),
    pageCount: integer("page_count"),
    extractionStatus: varchar("extraction_status", { length: 30 })
      .default("pending")
      .notNull(),
    extractionConfidence: numeric("extraction_confidence", {
      precision: 5,
      scale: 4,
    }),
    extractedData: jsonb("extracted_data"),
    documentNumber: varchar("document_number", { length: 100 }),
    documentDate: timestamp("document_date", { withTimezone: true }),
    relatedInvoiceNumber: varchar("related_invoice_number", { length: 100 }),
    reviewDecision: varchar("review_decision", { length: 30 }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idxImportCaseDocumentsCase: index("idx_import_case_documents_case").on(
      table.importCaseId,
    ),
    idxImportCaseDocumentsType: index("idx_import_case_documents_type").on(
      table.documentType,
    ),
    idxImportCaseDocumentsStatus: index("idx_import_case_documents_status").on(
      table.status,
    ),
  }),
);

export type ImportCaseDocumentRow = typeof importCaseDocuments.$inferSelect;
export type ImportCaseDocumentInsert = typeof importCaseDocuments.$inferInsert;
