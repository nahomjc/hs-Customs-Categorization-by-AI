import { pgTable, varchar, text } from "drizzle-orm/pg-core";

export const hsCodeReference = pgTable("hs_code_reference", {
  hsCode: varchar("hs_code", { length: 20 }).primaryKey(),
  category: varchar("category", { length: 100 }),
  description: text("description"),
});
