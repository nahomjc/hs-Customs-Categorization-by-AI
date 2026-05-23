import {
  foreignKey,
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const settings = pgTable(
  "settings",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tenantId: varchar("tenant_id", { length: 30 }).notNull(),
    userId: uuid("user_id").notNull(),
    preferences: jsonb("preferences").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idxSettingsTenantId: index("idx_settings_tenant_id").on(table.tenantId),
    idxSettingsUserId: index("idx_settings_user_id").on(table.userId),
    settingsUserIdUnique: unique("settings_user_id_unique").on(table.userId),
    settingsUserIdFkey: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "settings_user_id_fkey",
    }).onDelete("cascade"),
  })
);
