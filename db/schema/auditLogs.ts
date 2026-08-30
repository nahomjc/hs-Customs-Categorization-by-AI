import {
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

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tenantId: varchar("tenant_id", { length: 30 }).notNull(),
    importCaseId: uuid("import_case_id").references(() => importCases.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    oldData: jsonb("old_data"),
    newData: jsonb("new_data"),
    reason: text("reason"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idxAuditLogsTenant: index("idx_audit_logs_tenant").on(table.tenantId),
    idxAuditLogsCase: index("idx_audit_logs_case").on(table.importCaseId),
    idxAuditLogsEntity: index("idx_audit_logs_entity").on(
      table.entityType,
      table.entityId,
    ),
  }),
);

export type AuditLogRow = typeof auditLogs.$inferSelect;
export type AuditLogInsert = typeof auditLogs.$inferInsert;
