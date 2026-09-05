import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthUser } from "@/lib/auth/session";
import { getTenantChannelSettings } from "@/lib/notifications/channel-settings";
import { getTenantId } from "@/lib/import-cases/queries";

export async function GET() {
  const user = await getAuthUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profile] = await db
    .select({
      telegramChatId: users.telegramChatId,
      telegramLinkedAt: users.telegramLinkedAt,
      telegramLinkToken: users.telegramLinkToken,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const settings = await getTenantChannelSettings(getTenantId());

  return NextResponse.json({
    linked: Boolean(profile?.telegramChatId),
    telegramChatId: profile?.telegramChatId ?? null,
    telegramLinkedAt: profile?.telegramLinkedAt ?? null,
    botUsername: settings.telegramBotUsername,
    telegramEnabled: settings.telegramEnabled,
  });
}

export async function POST() {
  const user = await getAuthUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getTenantChannelSettings(getTenantId());
  if (!settings.telegramEnabled || !settings.telegramBotUsername) {
    return NextResponse.json(
      { error: "Telegram is not configured by admin yet" },
      { status: 400 },
    );
  }

  const token = randomBytes(16).toString("hex");
  await db
    .update(users)
    .set({
      telegramLinkToken: token,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  const deepLink = `https://t.me/${settings.telegramBotUsername}?start=${token}`;
  return NextResponse.json({ deepLink, token });
}

export async function DELETE() {
  const user = await getAuthUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .update(users)
    .set({
      telegramChatId: null,
      telegramLinkedAt: null,
      telegramLinkToken: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return NextResponse.json({ ok: true });
}
