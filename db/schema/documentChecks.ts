import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { importCaseDocuments } from "./importCaseDocuments";
import { importCases } from "./importCases";
import { importProducts } from "./importProducts";
import { users } from "./users";

export const documentChecks = pgTable(
  "document_checks",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    importCaseId: uuid("import_case_id")
      .references(() => importCases.id, { onDelete: "cascade" })
      .notNull(),
    documentId: uuid("document_id").references(() => importCaseDocuments.id, {
      onDelete: "cascade",
    }),
    productId: uuid("product_id").references(() => importProducts.id, {
      onDelete: "cascade",
    }),
    checkType: varchar("check_type", { length: 80 }).notNull(),
    severity: varchar("severity", { length: 10 }).notNull(),
    status: varchar("status", { length: 20 }).default("open").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    details: jsonb("details"),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idxDocumentChecksCase: index("idx_document_checks_case").on(
      table.importCaseId,
    ),
    idxDocumentChecksSeverity: index("idx_document_checks_severity").on(
      table.severity,
    ),
    idxDocumentChecksStatus: index("idx_document_checks_status").on(
      table.status,
    ),
  }),
);

export type DocumentCheckRow = typeof documentChecks.$inferSelect;
export type DocumentCheckInsert = typeof documentChecks.$inferInsert;
