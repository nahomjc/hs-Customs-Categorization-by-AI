import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  notificationLogs,
  notifications,
  users,
} from "@/db/schema";
import { getUserPreferences } from "@/lib/settings/user-settings";
import { getTenantChannelSettings } from "@/lib/notifications/channel-settings";
import {
  hasConfiguredSms,
  sendTenantSms,
} from "@/lib/notifications/send-tenant-sms";
import { sendTelegramMessage } from "@/lib/notifications/telegram";
import {
  trackingClientMessage,
  trackingNotificationTitle,
  trackingSmsText,
} from "@/lib/tracking/client-message";
import type { TrackingStatus } from "@/lib/tracking/constants";

export type TrackingNotifyChannel = "dashboard" | "telegram" | "sms";

export type TrackingNotificationDelivery = {
  dashboard: "sent" | "skipped" | "failed";
  telegram: "sent" | "skipped" | "failed";
  sms: "sent" | "skipped" | "failed";
  /** Human-readable detail for staff UI toasts. */
  messages: string[];
};

export async function notifyClientTrackingUpdate(params: {
  tenantId: string;
  importCaseId: string;
  caseNumber: string;
  clientUserId: string;
  status: TrackingStatus;
  note?: string | null;
}): Promise<TrackingNotificationDelivery> {
  const delivery: TrackingNotificationDelivery = {
    dashboard: "skipped",
    telegram: "skipped",
    sms: "skipped",
    messages: [],
  };

  const [client] = await db
    .select()
    .from(users)
    .where(eq(users.id, params.clientUserId))
    .limit(1);

  if (!client) {
    delivery.messages.push("No linked client user found for this case.");
    return delivery;
  }

  const prefs = await getUserPreferences(client.id);
  const channels = await getTenantChannelSettings(params.tenantId);
  const title = trackingNotificationTitle(params.caseNumber, params.status);
  const body = trackingClientMessage(params.status, params.note);

  // Always store in-app so clients see the same message as SMS/Telegram on login.
  try {
    await db.insert(notifications).values({
      tenantId: params.tenantId,
      userId: client.id,
      importCaseId: params.importCaseId,
      title,
      body,
      meta: {
        trackingStatus: params.status,
        caseNumber: params.caseNumber,
        message: body,
      },
    });
    await db.insert(notificationLogs).values({
      tenantId: params.tenantId,
      importCaseId: params.importCaseId,
      userId: client.id,
      channel: "dashboard",
      status: "sent",
      payloadSnippet: body.slice(0, 500),
    });
    delivery.dashboard = "sent";
  } catch (error) {
    delivery.dashboard = "failed";
    delivery.messages.push(
      error instanceof Error ? error.message : "Dashboard notification failed",
    );
    await db.insert(notificationLogs).values({
      tenantId: params.tenantId,
      importCaseId: params.importCaseId,
      userId: client.id,
      channel: "dashboard",
      status: "failed",
      payloadSnippet: body.slice(0, 500),
      error: error instanceof Error ? error.message : "dashboard notify failed",
    });
  }

  if (!prefs.notifyTelegram) {
    delivery.messages.push("Client turned off Telegram notifications.");
  } else if (!channels.telegramEnabled || !channels.telegramBotToken) {
    delivery.messages.push("Telegram is not configured for this tenant.");
  } else if (!client.telegramChatId) {
    delivery.messages.push("Client has not linked Telegram.");
  } else {
    const result = await sendTelegramMessage({
      botToken: channels.telegramBotToken,
      chatId: client.telegramChatId,
      text: `${title}\n\n${body}`,
    });
    await db.insert(notificationLogs).values({
      tenantId: params.tenantId,
      importCaseId: params.importCaseId,
      userId: client.id,
      channel: "telegram",
      status: result.ok ? "sent" : "failed",
      payloadSnippet: body.slice(0, 500),
      error: result.error ?? null,
    });
    delivery.telegram = result.ok ? "sent" : "failed";
    if (!result.ok && result.error) {
      delivery.messages.push(`Telegram: ${result.error}`);
    }
  }

  if (!prefs.notifySms) {
    delivery.messages.push("Client turned off SMS notifications.");
  } else if (!channels.smsEnabled) {
    delivery.messages.push(
      "Outbound SMS is disabled. Enable it under Settings → Channels.",
    );
  } else if (!hasConfiguredSms(channels)) {
    delivery.messages.push("SMS provider API key is not configured.");
  } else if (!client.phone?.trim()) {
    delivery.messages.push(
      "Client has no phone number on their profile (use 251… format).",
    );
  } else {
    const smsText = trackingSmsText(
      params.caseNumber,
      params.status,
      params.note,
    );
    const result = await sendTenantSms({
      tenantId: params.tenantId,
      phone: client.phone,
      text: smsText,
      settings: channels,
    });
    await db.insert(notificationLogs).values({
      tenantId: params.tenantId,
      importCaseId: params.importCaseId,
      userId: client.id,
      channel: "sms",
      status: result.ok ? "sent" : "failed",
      payloadSnippet: smsText,
      error: result.error ?? null,
    });
    delivery.sms = result.ok ? "sent" : "failed";
    if (!result.ok && result.error) {
      delivery.messages.push(`SMS: ${result.error}`);
    }
  }

  return delivery;
}
