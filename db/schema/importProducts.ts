import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { importCases } from "./importCases";
import { users } from "./users";

export const importProducts = pgTable(
  "import_products",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    importCaseId: uuid("import_case_id")
      .references(() => importCases.id, { onDelete: "cascade" })
      .notNull(),
    productSequence: integer("product_sequence").notNull(),
    status: varchar("status", { length: 40 }).default("draft").notNull(),
    rawDescription: text("raw_description").notNull(),
    normalizedDescription: text("normalized_description"),
    productName: varchar("product_name", { length: 255 }),
    brand: varchar("brand", { length: 100 }),
    modelNumber: varchar("model_number", { length: 100 }),
    manufacturer: varchar("manufacturer", { length: 255 }),
    material: varchar("material", { length: 255 }),
    intendedUse: text("intended_use"),
    productType: varchar("product_type", { length: 100 }),
    technicalSpecifications: jsonb("technical_specifications"),
    quantity: numeric("quantity", { precision: 18, scale: 4 }),
    unitOfMeasure: varchar("unit_of_measure", { length: 30 }),
    unitPrice: numeric("unit_price", { precision: 18, scale: 4 }),
    lineTotalAmount: numeric("line_total_amount", { precision: 18, scale: 2 }),
    currencyCode: varchar("currency_code", { length: 3 }),
    countryOfOriginCode: varchar("country_of_origin_code", { length: 3 }),
    netWeightKg: numeric("net_weight_kg", { precision: 18, scale: 3 }),
    grossWeightKg: numeric("gross_weight_kg", { precision: 18, scale: 3 }),
    packageType: varchar("package_type", { length: 50 }),
    numberOfPackages: numeric("number_of_packages", {
      precision: 18,
      scale: 2,
    }),
    missingInformation: jsonb("missing_information").default([]).notNull(),
    normalizationConfidence: numeric("normalization_confidence", {
      precision: 5,
      scale: 4,
    }),
    humanVerified: boolean("human_verified").default(false).notNull(),
    verifiedByUserId: uuid("verified_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    caseSequenceUnique: unique("import_products_case_sequence_unique").on(
      table.importCaseId,
      table.productSequence,
    ),
    idxImportProductsCase: index("idx_import_products_case").on(
      table.importCaseId,
    ),
    idxImportProductsStatus: index("idx_import_products_status").on(
      table.status,
    ),
  }),
);

export type ImportProductRow = typeof importProducts.$inferSelect;
export type ImportProductInsert = typeof importProducts.$inferInsert;
