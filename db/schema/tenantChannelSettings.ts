import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const tenantChannelSettings = pgTable(
  "tenant_channel_settings",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tenantId: varchar("tenant_id", { length: 30 }).notNull(),
    telegramEnabled: boolean("telegram_enabled").default(false).notNull(),
    telegramBotToken: text("telegram_bot_token"),
    telegramBotUsername: varchar("telegram_bot_username", { length: 100 }),
    telegramWebhookSecret: varchar("telegram_webhook_secret", { length: 128 }),
    smsEnabled: boolean("sms_enabled").default(false).notNull(),
    smsEthiopiaApiKey: text("sms_ethiopia_api_key"),
    /** Staff phones allowed to send inbound SMS status commands (251…). */
    authorizedStaffPhones: jsonb("authorized_staff_phones")
      .$type<string[]>()
      .default([])
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantUnique: unique("tenant_channel_settings_tenant_unique").on(
      table.tenantId,
    ),
    idxTenantChannelSettingsTenant: index(
      "idx_tenant_channel_settings_tenant",
    ).on(table.tenantId),
  }),
);

export type TenantChannelSettingsRow =
  typeof tenantChannelSettings.$inferSelect;
