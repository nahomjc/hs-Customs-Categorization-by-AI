import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  notificationLogs,
  notifications,
  users,
} from "@/db/schema";
import { getUserPreferences } from "@/lib/settings/user-settings";
import { getTenantChannelSettings } from "@/lib/notifications/channel-settings";
import { sendSmsEthiopia } from "@/lib/notifications/sms-ethiopia";
import { sendTelegramMessage } from "@/lib/notifications/telegram";
import {
  TRACKING_STATUS_LABELS,
  type TrackingStatus,
} from "@/lib/tracking/constants";

export async function notifyClientTrackingUpdate(params: {
  tenantId: string;
  importCaseId: string;
  caseNumber: string;
  clientUserId: string;
  status: TrackingStatus;
  note?: string | null;
}) {
  const [client] = await db
    .select()
    .from(users)
    .where(eq(users.id, params.clientUserId))
    .limit(1);

  if (!client) return;

  const prefs = await getUserPreferences(client.id);
  const channels = await getTenantChannelSettings(params.tenantId);
  const label = TRACKING_STATUS_LABELS[params.status];
  const title = `${params.caseNumber}: ${label}`;
  const body = params.note?.trim()
    ? `Your shipment is now at "${label}". Note: ${params.note.trim()}`
    : `Your shipment is now at "${label}".`;

  if (prefs.notifyDashboard) {
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
    } catch (error) {
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
  }

  if (
    prefs.notifyTelegram &&
    channels.telegramEnabled &&
    channels.telegramBotToken &&
    client.telegramChatId
  ) {
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
  }

  if (
    prefs.notifySms &&
    channels.smsEnabled &&
    channels.smsEthiopiaApiKey &&
    client.phone
  ) {
    const smsText = `${params.caseNumber}: ${label}${
      params.note?.trim() ? ` — ${params.note.trim()}` : ""
    }`.slice(0, 160);
    const result = await sendSmsEthiopia({
      apiKey: channels.smsEthiopiaApiKey,
      phone: client.phone,
      text: smsText,
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
  }
}
