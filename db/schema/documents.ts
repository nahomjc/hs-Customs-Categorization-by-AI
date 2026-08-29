import { pgTable, uuid, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  tenantId: varchar("tenant_id", { length: 30 }).notNull(),
  uploadedBy: varchar("uploaded_by", { length: 100 }).notNull(),
  originalFileUrl: text("original_file_url").notNull(),
  originalFileName: varchar("original_file_name", { length: 255 }),
  fileType: varchar("file_type", { length: 20 }).notNull(), // pdf | docx | xlsx | csv
  extractedText: text("extracted_text"),
  status: varchar("status", { length: 30 }).default("uploaded"),
  /** ai = classify with model; pre_coded = use HS column from document */
  classificationMode: varchar("classification_mode", { length: 30 }).default(
    "ai"
  ),
  // uploaded | parsed | ai_processed | grouped | completed | failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
