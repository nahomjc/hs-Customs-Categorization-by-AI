import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tenantId: varchar("tenant_id", { length: 30 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    countryCode: varchar("country_code", { length: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idxSuppliersTenant: index("idx_suppliers_tenant").on(table.tenantId),
    idxSuppliersTenantName: index("idx_suppliers_tenant_name").on(
      table.tenantId,
      table.name,
    ),
    uqSuppliersTenantNameLower: uniqueIndex("uq_suppliers_tenant_name_lower").on(
      table.tenantId,
      sql`lower(${table.name})`,
    ),
  }),
);

export type SupplierRow = typeof suppliers.$inferSelect;
export type SupplierInsert = typeof suppliers.$inferInsert;
