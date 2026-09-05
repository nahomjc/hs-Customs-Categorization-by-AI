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

export const trackingStatusEvents = pgTable(
  "tracking_status_events",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tenantId: varchar("tenant_id", { length: 30 }).notNull(),
    importCaseId: uuid("import_case_id")
      .references(() => importCases.id, { onDelete: "cascade" })
      .notNull(),
    status: varchar("status", { length: 40 }).notNull(),
    note: text("note"),
    source: varchar("source", { length: 30 }).default("web").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idxTrackingEventsCase: index("idx_tracking_status_events_case").on(
      table.importCaseId,
    ),
    idxTrackingEventsTenant: index("idx_tracking_status_events_tenant").on(
      table.tenantId,
    ),
  }),
);

export type TrackingStatusEventRow = typeof trackingStatusEvents.$inferSelect;
