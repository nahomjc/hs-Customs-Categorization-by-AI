import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantChannelSettings } from "@/db/schema";

export type ChannelSettings = {
  telegramEnabled: boolean;
  telegramBotToken: string | null;
  telegramBotUsername: string | null;
  telegramWebhookSecret: string | null;
  smsEnabled: boolean;
  smsEthiopiaApiKey: string | null;
  authorizedStaffPhones: string[];
};

function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export async function getTenantChannelSettings(
  tenantId: string,
): Promise<ChannelSettings> {
  const [row] = await db
    .select()
    .from(tenantChannelSettings)
    .where(eq(tenantChannelSettings.tenantId, tenantId))
    .limit(1);

  const envTelegram = process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
  const envSms = process.env.SMS_ETHIOPIA_API_KEY?.trim() || null;

  return {
    telegramEnabled: row?.telegramEnabled ?? Boolean(envTelegram),
    telegramBotToken: row?.telegramBotToken ?? envTelegram,
    telegramBotUsername: row?.telegramBotUsername ?? null,
    telegramWebhookSecret: row?.telegramWebhookSecret ?? null,
    smsEnabled: row?.smsEnabled ?? Boolean(envSms),
    smsEthiopiaApiKey: row?.smsEthiopiaApiKey ?? envSms,
    authorizedStaffPhones: Array.isArray(row?.authorizedStaffPhones)
      ? row.authorizedStaffPhones
      : [],
  };
}

export async function upsertTenantChannelSettings(
  tenantId: string,
  patch: {
    telegramEnabled?: boolean;
    telegramBotToken?: string | null;
    telegramBotUsername?: string | null;
    telegramWebhookSecret?: string | null;
    smsEnabled?: boolean;
    smsEthiopiaApiKey?: string | null;
    authorizedStaffPhones?: string[];
    clearTelegramBotToken?: boolean;
    clearSmsApiKey?: boolean;
  },
) {
  const existing = await getTenantChannelSettings(tenantId);
  const now = new Date();

  const telegramBotToken = patch.clearTelegramBotToken
    ? null
    : patch.telegramBotToken !== undefined
      ? patch.telegramBotToken
      : existing.telegramBotToken;
  const smsEthiopiaApiKey = patch.clearSmsApiKey
    ? null
    : patch.smsEthiopiaApiKey !== undefined
      ? patch.smsEthiopiaApiKey
      : existing.smsEthiopiaApiKey;

  const values = {
    tenantId,
    telegramEnabled: patch.telegramEnabled ?? existing.telegramEnabled,
    telegramBotToken,
    telegramBotUsername:
      patch.telegramBotUsername !== undefined
        ? patch.telegramBotUsername
        : existing.telegramBotUsername,
    telegramWebhookSecret:
      patch.telegramWebhookSecret !== undefined
        ? patch.telegramWebhookSecret
        : existing.telegramWebhookSecret,
    smsEnabled: patch.smsEnabled ?? existing.smsEnabled,
    smsEthiopiaApiKey,
    authorizedStaffPhones:
      patch.authorizedStaffPhones ?? existing.authorizedStaffPhones,
    updatedAt: now,
  };

  await db
    .insert(tenantChannelSettings)
    .values({
      ...values,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: tenantChannelSettings.tenantId,
      set: values,
    });

  return getTenantChannelSettings(tenantId);
}

export function toPublicChannelSettings(settings: ChannelSettings) {
  return {
    telegramEnabled: settings.telegramEnabled,
    telegramBotUsername: settings.telegramBotUsername,
    telegramBotTokenMasked: maskSecret(settings.telegramBotToken),
    telegramWebhookSecretMasked: maskSecret(settings.telegramWebhookSecret),
    hasTelegramBotToken: Boolean(settings.telegramBotToken),
    smsEnabled: settings.smsEnabled,
    smsEthiopiaApiKeyMasked: maskSecret(settings.smsEthiopiaApiKey),
    hasSmsApiKey: Boolean(settings.smsEthiopiaApiKey),
    authorizedStaffPhones: settings.authorizedStaffPhones,
  };
}

export async function findTenantIdByTelegramSecret(
  secret: string,
): Promise<string | null> {
  const [row] = await db
    .select({ tenantId: tenantChannelSettings.tenantId })
    .from(tenantChannelSettings)
    .where(
      and(
        eq(tenantChannelSettings.telegramWebhookSecret, secret),
        eq(tenantChannelSettings.telegramEnabled, true),
      ),
    )
    .limit(1);
  return row?.tenantId ?? null;
}
