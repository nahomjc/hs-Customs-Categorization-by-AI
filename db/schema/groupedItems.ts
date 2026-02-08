import {
  pgTable,
  uuid,
  text,
  integer,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";
import { documents } from "./documents";

export const groupedItems = pgTable("grouped_items", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  documentId: uuid("document_id")
    .references(() => documents.id, { onDelete: "cascade" })
    .notNull(),
  hsCode: varchar("hs_code", { length: 20 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  finalDescription: text("final_description").notNull(),
  totalQuantity: integer("total_quantity").notNull(),
  unit: varchar("unit", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
