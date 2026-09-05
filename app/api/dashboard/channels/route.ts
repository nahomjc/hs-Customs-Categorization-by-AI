import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getTenantId } from "@/lib/import-cases/queries";
import { normalizeEthiopiaPhone } from "@/lib/notifications/phone";
import {
  getTenantChannelSettings,
  toPublicChannelSettings,
  upsertTenantChannelSettings,
} from "@/lib/notifications/channel-settings";
import {
  getTelegramBotUsername,
  setTelegramWebhook,
  sendTelegramMessage,
} from "@/lib/notifications/telegram";
import { sendSmsEthiopia } from "@/lib/notifications/sms-ethiopia";
import { getAppOrigin } from "@/lib/auth/redirect-origin";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const settings = await getTenantChannelSettings(getTenantId());
  return NextResponse.json({
    ...toPublicChannelSettings(settings),
    webhookUrl: `${getAppOrigin()}/api/webhooks/telegram`,
    smsWebhookUrl: `${getAppOrigin()}/api/webhooks/sms-ethiopia`,
  });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  let body: {
    telegramEnabled?: boolean;
    telegramBotToken?: string;
    clearTelegramBotToken?: boolean;
    smsEnabled?: boolean;
    smsEthiopiaApiKey?: string;
    clearSmsApiKey?: boolean;
    authorizedStaffPhones?: string[];
    setWebhook?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tenantId = getTenantId();
  const current = await getTenantChannelSettings(tenantId);

  let telegramWebhookSecret = current.telegramWebhookSecret;
  if (body.setWebhook || body.telegramBotToken) {
    telegramWebhookSecret =
      current.telegramWebhookSecret || randomBytes(24).toString("hex");
  }

  const phones = Array.isArray(body.authorizedStaffPhones)
    ? body.authorizedStaffPhones
        .map((p) => normalizeEthiopiaPhone(String(p)) ?? String(p).trim())
        .filter(Boolean)
    : undefined;

  const next = await upsertTenantChannelSettings(tenantId, {
    telegramEnabled: body.telegramEnabled,
    telegramBotToken: body.telegramBotToken?.trim() || undefined,
    clearTelegramBotToken: body.clearTelegramBotToken,
    telegramWebhookSecret,
    smsEnabled: body.smsEnabled,
    smsEthiopiaApiKey: body.smsEthiopiaApiKey?.trim() || undefined,
    clearSmsApiKey: body.clearSmsApiKey,
    authorizedStaffPhones: phones,
  });

  let webhookError: string | null = null;
  if (body.setWebhook && next.telegramBotToken && telegramWebhookSecret) {
    const username = await getTelegramBotUsername(next.telegramBotToken);
    const result = await setTelegramWebhook({
      botToken: next.telegramBotToken,
      url: `${getAppOrigin()}/api/webhooks/telegram`,
      secretToken: telegramWebhookSecret,
    });
    if (!result.ok) {
      webhookError = result.error ?? "Failed to set webhook";
    } else {
      await upsertTenantChannelSettings(tenantId, {
        telegramBotUsername: username,
        telegramWebhookSecret,
      });
    }
  } else if (next.telegramBotToken && !next.telegramBotUsername) {
    const username = await getTelegramBotUsername(next.telegramBotToken);
    if (username) {
      await upsertTenantChannelSettings(tenantId, {
        telegramBotUsername: username,
      });
    }
  }

  const refreshed = await getTenantChannelSettings(tenantId);
  return NextResponse.json({
    ...toPublicChannelSettings(refreshed),
    webhookUrl: `${getAppOrigin()}/api/webhooks/telegram`,
    smsWebhookUrl: `${getAppOrigin()}/api/webhooks/sms-ethiopia`,
    webhookError,
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  let body: {
    channel?: "telegram" | "sms";
    target?: string;
    message?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const settings = await getTenantChannelSettings(getTenantId());
  const message = body.message?.trim() || "Test message from HS Classification";

  if (body.channel === "telegram") {
    if (!settings.telegramBotToken) {
      return NextResponse.json(
        { error: "Telegram bot token not configured" },
        { status: 400 },
      );
    }
    if (!body.target) {
      return NextResponse.json(
        { error: "Telegram chat id is required" },
        { status: 400 },
      );
    }
    const result = await sendTelegramMessage({
      botToken: settings.telegramBotToken,
      chatId: body.target,
      text: message,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (body.channel === "sms") {
    if (!settings.smsEthiopiaApiKey) {
      return NextResponse.json(
        { error: "SMS Ethiopia API key not configured" },
        { status: 400 },
      );
    }
    if (!body.target) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 },
      );
    }
    const result = await sendSmsEthiopia({
      apiKey: settings.smsEthiopiaApiKey,
      phone: body.target,
      text: message,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  return NextResponse.json({ error: "Unknown channel" }, { status: 400 });
}
