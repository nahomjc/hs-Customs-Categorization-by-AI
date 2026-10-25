import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";

export type InboxNotification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
  importCaseId: string | null;
};

export async function listInboxNotifications(
  userId: string,
  options?: { limit?: number; unreadOnly?: boolean },
): Promise<InboxNotification[]> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 200);
  const conditions = [eq(notifications.userId, userId)];
  if (options?.unreadOnly) {
    conditions.push(eq(notifications.read, false));
  }

  return db
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      read: notifications.read,
      createdAt: notifications.createdAt,
      importCaseId: notifications.importCaseId,
    })
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function countUnreadNotifications(
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), eq(notifications.read, false)),
    );
  return row?.count ?? 0;
}

export async function getInboxNotification(
  userId: string,
  id: string,
): Promise<InboxNotification | null> {
  const [row] = await db
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      read: notifications.read,
      createdAt: notifications.createdAt,
      importCaseId: notifications.importCaseId,
    })
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function markNotificationRead(
  userId: string,
  id: string,
  read = true,
): Promise<InboxNotification | null> {
  const [row] = await db
    .update(notifications)
    .set({ read })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      read: notifications.read,
      createdAt: notifications.createdAt,
      importCaseId: notifications.importCaseId,
    });
  return row ?? null;
}

export async function markAllNotificationsRead(
  userId: string,
): Promise<number> {
  const rows = await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(eq(notifications.userId, userId), eq(notifications.read, false)),
    )
    .returning({ id: notifications.id });
  return rows.length;
}
