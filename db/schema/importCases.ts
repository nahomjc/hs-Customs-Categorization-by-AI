import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const importCases = pgTable(
  "import_cases",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tenantId: varchar("tenant_id", { length: 30 }).notNull(),
    caseNumber: varchar("case_number", { length: 50 }).notNull(),
    status: varchar("status", { length: 40 }).default("draft").notNull(),
    importerName: varchar("importer_name", { length: 255 }),
    importerTinNumber: varchar("importer_tin_number", { length: 50 }),
    supplierName: varchar("supplier_name", { length: 255 }),
    supplierCountryCode: varchar("supplier_country_code", { length: 3 }),
    countryOfExportCode: varchar("country_of_export_code", { length: 3 }),
    countryOfOriginCode: varchar("country_of_origin_code", { length: 3 }),
    shipmentReference: varchar("shipment_reference", { length: 100 }),
    billOfLadingNumber: varchar("bill_of_lading_number", { length: 100 }),
    airwayBillNumber: varchar("airway_bill_number", { length: 100 }),
    importProcedureCode: varchar("import_procedure_code", { length: 50 }),
    incoterm: varchar("incoterm", { length: 20 }),
    invoiceCurrencyCode: varchar("invoice_currency_code", { length: 3 }),
    invoiceTotalAmount: numeric("invoice_total_amount", {
      precision: 18,
      scale: 2,
    }),
    freightAmount: numeric("freight_amount", { precision: 18, scale: 2 }),
    insuranceAmount: numeric("insurance_amount", { precision: 18, scale: 2 }),
    estimatedCifAmount: numeric("estimated_cif_amount", {
      precision: 18,
      scale: 2,
    }),
    assignedAgentId: uuid("assigned_agent_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid("created_by_user_id")
      .references(() => users.id, { onDelete: "set null" })
      .notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantCaseNumberUnique: unique("import_cases_tenant_case_number_unique").on(
      table.tenantId,
      table.caseNumber,
    ),
    idxImportCasesTenant: index("idx_import_cases_tenant").on(table.tenantId),
    idxImportCasesTenantStatus: index("idx_import_cases_tenant_status").on(
      table.tenantId,
      table.status,
    ),
    idxImportCasesAssignedAgent: index("idx_import_cases_assigned_agent").on(
      table.assignedAgentId,
    ),
    idxImportCasesCaseNumber: index("idx_import_cases_case_number").on(
      table.caseNumber,
    ),
  }),
);

export type ImportCaseRow = typeof importCases.$inferSelect;
export type ImportCaseInsert = typeof importCases.$inferInsert;
