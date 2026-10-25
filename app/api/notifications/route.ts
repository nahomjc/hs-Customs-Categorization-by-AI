import { NextRequest, NextResponse } from "next/server";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { canAccessPersonalShipments } from "@/lib/auth/roles";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/import-cases/api-helpers";
import {
  countUnreadNotifications,
  listInboxNotifications,
  markAllNotificationsRead,
} from "@/lib/notifications/client-inbox";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const session = await getSessionUserProfile();
  if (!canAccessPersonalShipments(session?.profile?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const unreadOnly =
    request.nextUrl.searchParams.get("unread") === "1" ||
    request.nextUrl.searchParams.get("unread") === "true";

  const [items, unread] = await Promise.all([
    listInboxNotifications(user.id, { unreadOnly, limit: 100 }),
    countUnreadNotifications(user.id),
  ]);

  return NextResponse.json({ items, unread });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const session = await getSessionUserProfile();
  if (!canAccessPersonalShipments(session?.profile?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action =
    body && typeof body === "object" && "action" in body
      ? String((body as { action?: string }).action)
      : "";

  if (action === "mark_all_read") {
    const updated = await markAllNotificationsRead(user.id);
    return NextResponse.json({ updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
