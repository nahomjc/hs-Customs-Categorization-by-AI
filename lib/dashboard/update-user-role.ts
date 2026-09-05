import { db } from "@/db";
import { users } from "@/db/schema";
import { isUserRole, type UserRole } from "@/lib/auth/roles";
import { syncAuthUserRole } from "@/lib/auth/sync-auth-role";
import { eq } from "drizzle-orm";

export async function updateUserRole(
  userId: string,
  role: UserRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUserRole(role)) {
    return { ok: false, error: "Invalid role" };
  }

  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!target) {
    return { ok: false, error: "User not found" };
  }

  if (target.role !== role) {
    await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  await syncAuthUserRole(userId, role);

  return { ok: true };
}
