import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { isStaffRole } from "@/lib/auth/roles";
import { getTenantChannelSettings } from "@/lib/notifications/channel-settings";
import {
  parseTelegramCommand,
  sendTelegramMessage,
  type TelegramUpdate,
} from "@/lib/notifications/telegram";
import {
  TRACKING_STATUSES,
  TRACKING_STATUS_LABELS,
} from "@/lib/tracking/constants";
import { updateTrackingStatus } from "@/lib/tracking/update-tracking-status";

async function reply(
  botToken: string,
  chatId: string,
  text: string,
) {
  await sendTelegramMessage({ botToken, chatId, text });
}

export async function POST(request: NextRequest) {
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  const tenantId = DEFAULT_TENANT_ID;
  const settings = await getTenantChannelSettings(tenantId);

  if (!settings.telegramEnabled || !settings.telegramBotToken) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (
    settings.telegramWebhookSecret &&
    secretHeader !== settings.telegramWebhookSecret
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = update.message;
  const text = message?.text?.trim();
  const chatId = message?.chat?.id != null ? String(message.chat.id) : null;
  if (!text || !chatId) {
    return NextResponse.json({ ok: true });
  }

  const botToken = settings.telegramBotToken;
  const { command, args } = parseTelegramCommand(text);

  if (command === "/start") {
    const token = args[0];
    if (!token) {
      await reply(
        botToken,
        chatId,
        "Open Settings in the app and use Connect Telegram to link your account.",
      );
      return NextResponse.json({ ok: true });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.telegramLinkToken, token),
        ),
      )
      .limit(1);

    if (!user) {
      await reply(botToken, chatId, "Invalid or expired link token.");
      return NextResponse.json({ ok: true });
    }

    await db
      .update(users)
      .set({
        telegramChatId: chatId,
        telegramLinkedAt: new Date(),
        telegramLinkToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await reply(
      botToken,
      chatId,
      `Linked to ${user.fullName ?? user.email}. You will receive shipment updates here.`,
    );
    return NextResponse.json({ ok: true });
  }

  if (command === "/statuses") {
    const list = TRACKING_STATUSES.map(
      (s) => `• ${s} — ${TRACKING_STATUS_LABELS[s]}`,
    ).join("\n");
    await reply(botToken, chatId, `Tracking statuses:\n${list}`);
    return NextResponse.json({ ok: true });
  }

  if (command === "/status") {
    const [actor] = await db
      .select()
      .from(users)
      .where(
        and(eq(users.tenantId, tenantId), eq(users.telegramChatId, chatId)),
      )
      .limit(1);

    if (!actor || !isStaffRole(actor.role)) {
      await reply(
        botToken,
        chatId,
        "Only linked staff accounts can update status. Link your staff Telegram from Settings.",
      );
      return NextResponse.json({ ok: true });
    }

    const caseNumber = args[0];
    const status = args[1]?.toLowerCase();
    const note = args.slice(2).join(" ").trim() || null;

    if (!caseNumber || !status) {
      await reply(
        botToken,
        chatId,
        "Usage: /status CASE_NUMBER STATUS [note]\nExample: /status IMP-2026-00001 customs_clearance At customs",
      );
      return NextResponse.json({ ok: true });
    }

    const result = await updateTrackingStatus({
      tenantId,
      caseNumber,
      status,
      note,
      source: "telegram",
      actorUserId: actor.id,
    });

    if (!result.ok) {
      await reply(botToken, chatId, `Error: ${result.error}`);
    } else {
      await reply(
        botToken,
        chatId,
        `Updated ${result.caseNumber} → ${TRACKING_STATUS_LABELS[result.status]}. Client notified.`,
      );
    }
    return NextResponse.json({ ok: true });
  }

  await reply(
    botToken,
    chatId,
    "Commands: /start <token>, /status CASE STATUS [note], /statuses",
  );
  return NextResponse.json({ ok: true });
}
