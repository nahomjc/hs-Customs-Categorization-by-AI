import {
  pgTable,
  uuid,
  text,
  varchar,
  decimal,
  timestamp,
} from "drizzle-orm/pg-core";
import { documentItems } from "./documentItems";

export const itemClassifications = pgTable("item_classifications", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  itemId: uuid("item_id")
    .references(() => documentItems.id, { onDelete: "cascade" })
    .notNull(),
  aiCategory: varchar("ai_category", { length: 100 }),
  aiHsCode: varchar("ai_hs_code", { length: 20 }),
  cleanDescription: text("clean_description"),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  aiRawResponse: text("ai_raw_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
