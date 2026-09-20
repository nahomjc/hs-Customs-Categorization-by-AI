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
import { users } from "./users";

/**
 * Logs free-text NLP HS-code searches for analytics and history.
 * Decision-support only — does not store final customs classifications.
 */
export const hsCodeSearchLogs = pgTable(
  "hs_code_search_logs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tenantId: varchar("tenant_id", { length: 30 }).notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    queryText: text("query_text").notNull(),
    extractedAttributes: jsonb("extracted_attributes"),
    resultsCount: integer("results_count").notNull().default(0),
    topHsCodeSuggested: varchar("top_hs_code_suggested", { length: 20 }),
    topConfidenceScore: numeric("top_confidence_score", {
      precision: 5,
      scale: 4,
    }),
    aiModelName: varchar("ai_model_name", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idxHsCodeSearchLogsTenant: index("idx_hs_code_search_logs_tenant").on(
      table.tenantId,
    ),
    idxHsCodeSearchLogsUser: index("idx_hs_code_search_logs_user").on(
      table.userId,
    ),
    idxHsCodeSearchLogsCreated: index("idx_hs_code_search_logs_created").on(
      table.createdAt,
    ),
  }),
);

export type HsCodeSearchLogRow = typeof hsCodeSearchLogs.$inferSelect;
export type HsCodeSearchLogInsert = typeof hsCodeSearchLogs.$inferInsert;
