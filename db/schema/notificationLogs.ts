import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { importCases } from "./importCases";
import { users } from "./users";

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tenantId: varchar("tenant_id", { length: 30 }).notNull(),
    importCaseId: uuid("import_case_id").references(() => importCases.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    channel: varchar("channel", { length: 30 }).notNull(),
    status: varchar("status", { length: 30 }).notNull(),
    payloadSnippet: text("payload_snippet"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idxNotificationLogsCase: index("idx_notification_logs_case").on(
      table.importCaseId,
    ),
    idxNotificationLogsTenant: index("idx_notification_logs_tenant").on(
      table.tenantId,
    ),
  }),
);

export type NotificationLogRow = typeof notificationLogs.$inferSelect;
