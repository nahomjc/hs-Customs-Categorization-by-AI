import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
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
  lineIndex: integer("line_index"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
