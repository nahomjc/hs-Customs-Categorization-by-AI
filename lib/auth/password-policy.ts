import { db } from "@/db";
import { users } from "@/db/schema";
import { SET_PASSWORD_PATH } from "@/lib/auth/must-change-password";
import { eq } from "drizzle-orm";

export async function userMustChangePassword(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ meta: users.meta })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row?.meta || typeof row.meta !== "object" || Array.isArray(row.meta)) {
    return false;
  }

  return (row.meta as Record<string, unknown>).must_change_password === true;
}

export async function clearMustChangePassword(userId: string) {
  const [row] = await db
    .select({ meta: users.meta })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const existingMeta =
    row?.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
      ? (row.meta as Record<string, unknown>)
      : {};

  await db
    .update(users)
    .set({
      meta: { ...existingMeta, must_change_password: false },
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function setMustChangePassword(userId: string) {
  const [row] = await db
    .select({ meta: users.meta })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const existingMeta =
    row?.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
      ? (row.meta as Record<string, unknown>)
      : {};

  await db
    .update(users)
    .set({
      meta: { ...existingMeta, must_change_password: true },
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export { SET_PASSWORD_PATH };
