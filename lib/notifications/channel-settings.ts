import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantChannelSettings } from "@/db/schema";

export type SmsProvider = "smshub" | "sms_ethiopia";

export type ChannelSettings = {
  telegramEnabled: boolean;
  telegramBotToken: string | null;
  telegramBotUsername: string | null;
  telegramWebhookSecret: string | null;
  smsEnabled: boolean;
  smsProvider: SmsProvider;
  smsSmshubApiKey: string | null;
  smsEthiopiaApiKey: string | null;
  authorizedStaffPhones: string[];
};

function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function parseSmsProvider(raw: string | null | undefined): SmsProvider {
  if (raw === "sms_ethiopia") return "sms_ethiopia";
  const env = process.env.SMS_PROVIDER?.trim();
  if (env === "sms_ethiopia") return "sms_ethiopia";
  return "smshub";
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
  const envSmsSmshub = process.env.SMSHUB_API_KEY?.trim() || null;
  const envSmsEthiopia = process.env.SMS_ETHIOPIA_API_KEY?.trim() || null;

  const smsProvider = row?.smsProvider
    ? parseSmsProvider(row.smsProvider)
    : parseSmsProvider(null);
  const smsSmshubApiKey = row?.smsSmshubApiKey ?? envSmsSmshub;
  const smsEthiopiaApiKey = row?.smsEthiopiaApiKey ?? envSmsEthiopia;

  const hasKey =
    smsProvider === "sms_ethiopia"
      ? Boolean(smsEthiopiaApiKey)
      : Boolean(smsSmshubApiKey);
  const hasAnyKey = Boolean(smsSmshubApiKey || smsEthiopiaApiKey);

  return {
    telegramEnabled: row?.telegramEnabled ?? Boolean(envTelegram),
    telegramBotToken: row?.telegramBotToken ?? envTelegram,
    telegramBotUsername: row?.telegramBotUsername ?? null,
    telegramWebhookSecret: row?.telegramWebhookSecret ?? null,
    smsEnabled: row?.smsEnabled ?? Boolean(hasKey || hasAnyKey),
    smsProvider,
    smsSmshubApiKey,
    smsEthiopiaApiKey,
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
    smsProvider?: SmsProvider;
    smsSmshubApiKey?: string | null;
    smsEthiopiaApiKey?: string | null;
    authorizedStaffPhones?: string[];
    clearTelegramBotToken?: boolean;
    clearSmsApiKey?: boolean;
    clearSmsSmshubApiKey?: boolean;
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
  const smsSmshubApiKey = patch.clearSmsSmshubApiKey
    ? null
    : patch.smsSmshubApiKey !== undefined
      ? patch.smsSmshubApiKey
      : existing.smsSmshubApiKey;

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
    smsProvider: patch.smsProvider ?? existing.smsProvider,
    smsSmshubApiKey,
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
  const hasSmsApiKey =
    settings.smsProvider === "sms_ethiopia"
      ? Boolean(settings.smsEthiopiaApiKey)
      : Boolean(settings.smsSmshubApiKey);

  return {
    telegramEnabled: settings.telegramEnabled,
    telegramBotUsername: settings.telegramBotUsername,
    telegramBotTokenMasked: maskSecret(settings.telegramBotToken),
    telegramWebhookSecretMasked: maskSecret(settings.telegramWebhookSecret),
    hasTelegramBotToken: Boolean(settings.telegramBotToken),
    smsEnabled: settings.smsEnabled,
    smsProvider: settings.smsProvider,
    smsEthiopiaApiKeyMasked: maskSecret(settings.smsEthiopiaApiKey),
    smsSmshubApiKeyMasked: maskSecret(settings.smsSmshubApiKey),
    hasSmsApiKey,
    hasSmsEthiopiaApiKey: Boolean(settings.smsEthiopiaApiKey),
    hasSmsSmshubApiKey: Boolean(settings.smsSmshubApiKey),
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
