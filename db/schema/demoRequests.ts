import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const demoRequests = pgTable(
  "demo_requests",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    company: varchar("company", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    jobTitle: varchar("job_title", { length: 120 }),
    monthlyVolume: varchar("monthly_volume", { length: 50 }),
    message: text("message"),
    status: varchar("status", { length: 30 }).default("new").notNull(),
    source: varchar("source", { length: 80 }).default("landing").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idxDemoRequestsEmail: index("idx_demo_requests_email").on(table.email),
    idxDemoRequestsCreatedAt: index("idx_demo_requests_created_at").on(
      table.createdAt
    ),
    idxDemoRequestsStatus: index("idx_demo_requests_status").on(table.status),
  })
);
