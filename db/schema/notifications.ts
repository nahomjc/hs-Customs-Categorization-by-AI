import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { importCases } from "./importCases";
import { users } from "./users";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tenantId: varchar("tenant_id", { length: 30 }).notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    importCaseId: uuid("import_case_id").references(() => importCases.id, {
      onDelete: "cascade",
    }),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    read: boolean("read").default(false).notNull(),
    meta: jsonb("meta").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idxNotificationsUser: index("idx_notifications_user").on(table.userId),
    idxNotificationsUserUnread: index("idx_notifications_user_unread").on(
      table.userId,
      table.read,
    ),
  }),
);

export type NotificationRow = typeof notifications.$inferSelect;
