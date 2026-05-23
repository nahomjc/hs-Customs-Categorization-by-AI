import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { documents } from "./documents";

export const documentItems = pgTable("document_items", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  documentId: uuid("document_id")
    .references(() => documents.id, { onDelete: "cascade" })
    .notNull(),
  rawLine: text("raw_line").notNull(),
  detectedDescription: text("detected_description"),
  detectedQuantity: integer("detected_quantity"),
  detectedUnit: text("detected_unit"),
  /** HS code read from packing list table (pre-coded documents) */
  sourceHsCode: varchar("source_hs_code", { length: 20 }),
  lineNumber: integer("line_number"),
  specification: text("specification"),
  lineIndex: integer("line_index"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
