import {
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { importProducts } from "./importProducts";

export const tariffSnapshots = pgTable("tariff_snapshots", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  productId: uuid("product_id")
    .references(() => importProducts.id, { onDelete: "cascade" })
    .notNull(),
  hsCode: varchar("hs_code", { length: 20 }).notNull(),
  tariffVersion: varchar("tariff_version", { length: 50 }).notNull(),
  countryOfOriginCode: varchar("country_of_origin_code", { length: 3 }),
  procedureCode: varchar("procedure_code", { length: 50 }),
  customsDutyRate: numeric("customs_duty_rate", { precision: 8, scale: 4 }),
  vatRate: numeric("vat_rate", { precision: 8, scale: 4 }),
  exciseRate: numeric("excise_rate", { precision: 8, scale: 4 }),
  surtaxRate: numeric("surtax_rate", { precision: 8, scale: 4 }),
  otherCharges: jsonb("other_charges"),
  permitRequirements: jsonb("permit_requirements").default([]).notNull(),
  restrictions: jsonb("restrictions").default([]).notNull(),
  sourceReference: text("source_reference"),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type TariffSnapshotRow = typeof tariffSnapshots.$inferSelect;
export type TariffSnapshotInsert = typeof tariffSnapshots.$inferInsert;
