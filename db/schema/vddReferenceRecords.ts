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
import { vddImportBatches } from "./vddImportBatches";

export const vddReferenceRecords = pgTable(
  "vdd_reference_records",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tenantId: varchar("tenant_id", { length: 30 }).notNull(),
    importBatchId: uuid("import_batch_id")
      .references(() => vddImportBatches.id, { onDelete: "cascade" })
      .notNull(),
    sourceFileName: text("source_file_name").notNull(),
    sourceRowNumber: integer("source_row_number").notNull(),
    importerName: varchar("importer_name", { length: 255 }),
    declarationNumber: varchar("declaration_number", { length: 100 }),
    hsCode: varchar("hs_code", { length: 20 }).notNull(),
    unitOfQuantity: varchar("unit_of_quantity", { length: 50 }),
    originCode: varchar("origin_code", { length: 10 }),
    countryName: varchar("country_name", { length: 100 }),
    brandOrMake: varchar("brand_or_make", { length: 150 }),
    model: varchar("model", { length: 150 }),
    commonName: text("common_name"),
    condition: varchar("condition", { length: 50 }),
    commercialDescription: text("commercial_description"),
    appearance: varchar("appearance", { length: 50 }),
    material: varchar("material", { length: 255 }),
    size: varchar("size", { length: 100 }),
    productType: varchar("product_type", { length: 100 }),
    diameter: numeric("diameter", { precision: 18, scale: 4 }),
    width: numeric("width", { precision: 18, scale: 4 }),
    length: numeric("length", { precision: 18, scale: 4 }),
    declaredUnitPrice: numeric("declared_unit_price", {
      precision: 18,
      scale: 4,
    }),
    netMass: numeric("net_mass", { precision: 18, scale: 3 }),
    grossMass: numeric("gross_mass", { precision: 18, scale: 3 }),
    currencyCode: varchar("currency_code", { length: 3 })
      .default("USD")
      .notNull(),
    normalizedText: text("normalized_text"),
    normalizedData: jsonb("normalized_data"),
    rawRow: jsonb("raw_row"),
    extraAttributes: jsonb("extra_attributes").default({}).notNull(),
    dataQualityFlags: jsonb("data_quality_flags").default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idxVddRefHsCode: index("idx_vdd_reference_records_hs_code").on(
      table.hsCode,
    ),
    idxVddRefModel: index("idx_vdd_reference_records_model").on(table.model),
    idxVddRefBrand: index("idx_vdd_reference_records_brand").on(
      table.brandOrMake,
    ),
    idxVddRefOrigin: index("idx_vdd_reference_records_origin").on(
      table.originCode,
    ),
    idxVddRefCommonName: index("idx_vdd_reference_records_common_name").on(
      table.commonName,
    ),
    idxVddRefBatch: index("idx_vdd_reference_records_batch").on(
      table.importBatchId,
    ),
    idxVddRefTenant: index("idx_vdd_reference_records_tenant").on(
      table.tenantId,
    ),
  }),
);

export type VddReferenceRecordRow = typeof vddReferenceRecords.$inferSelect;
export type VddReferenceRecordInsert = typeof vddReferenceRecords.$inferInsert;
