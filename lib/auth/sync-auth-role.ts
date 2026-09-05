import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authUser } from "@/db/schema/auth";

/**
 * Better Auth admin plugin reads role from the auth `user` table, while the
 * app dashboard uses `users.role`. Keep them aligned so admin APIs (invite,
 * set password, etc.) work for profile admins.
 */
export function toAuthPluginRole(appRole: string | null | undefined): string {
  return appRole === "admin" ? "admin" : "user";
}

export async function syncAuthUserRole(
  userId: string,
  appRole: string | null | undefined,
): Promise<void> {
  const role = toAuthPluginRole(appRole);
  await db
    .update(authUser)
    .set({ role, updatedAt: new Date() })
    .where(eq(authUser.id, userId));
}
