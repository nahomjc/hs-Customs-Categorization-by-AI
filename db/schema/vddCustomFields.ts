import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Tenant-defined VDD columns (beyond the fixed core fields).
 * Values live on vdd_reference_records.extra_attributes under fieldKey.
 */
export const vddCustomFields = pgTable(
  "vdd_custom_fields",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tenantId: varchar("tenant_id", { length: 30 }).notNull(),
    fieldKey: varchar("field_key", { length: 80 }).notNull(),
    label: varchar("label", { length: 150 }).notNull(),
    valueType: varchar("value_type", { length: 20 }).default("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idxVddCustomFieldsTenant: index("idx_vdd_custom_fields_tenant").on(
      table.tenantId,
    ),
    uqVddCustomFieldsTenantKey: uniqueIndex(
      "uq_vdd_custom_fields_tenant_key",
    ).on(table.tenantId, table.fieldKey),
  }),
);

export type VddCustomFieldRow = typeof vddCustomFields.$inferSelect;
export type VddCustomFieldInsert = typeof vddCustomFields.$inferInsert;
