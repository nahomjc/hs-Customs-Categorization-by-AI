import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().notNull(),
    tenantId: varchar("tenant_id", { length: 30 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }),
    avatarUrl: text("avatar_url"),
    role: varchar("role", { length: 30 }).default("user").notNull(),
    status: varchar("status", { length: 30 }).default("active").notNull(),
    meta: jsonb("meta").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    usersTenantEmailUnique: unique("users_tenant_email_unique").on(
      table.tenantId,
      table.email
    ),
  })
);
