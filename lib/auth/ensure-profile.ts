import { db } from "@/db";
import { users } from "@/db/schema/users";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { syncAuthUserRole } from "@/lib/auth/sync-auth-role";
import { syncAuthEmailVerified } from "@/lib/dashboard/update-user-verification";
import { ensureUserSettingsRow } from "@/lib/settings/user-settings";
import { and, eq, sql } from "drizzle-orm";

export async function ensureUserProfile(input: {
  id: string;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  tenantId?: string;
  role?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
}) {
  const tenantId = input.tenantId ?? DEFAULT_TENANT_ID;
  const now = new Date();
  const phone =
    input.phone != null && String(input.phone).trim() !== ""
      ? String(input.phone).trim()
      : null;

  const emailVerified = input.emailVerified ?? false;
  const phoneVerified = input.phoneVerified ?? false;

  await db
    .insert(users)
    .values({
      id: input.id,
      tenantId,
      email: input.email,
      fullName: input.fullName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      phone,
      emailVerified,
      phoneVerified,
      role: input.role ?? "user",
      meta: {},
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: input.email,
        fullName: input.fullName ?? null,
        avatarUrl: input.avatarUrl ?? null,
        ...(phone ? { phone } : {}),
        ...(input.role ? { role: input.role } : {}),
        ...(input.emailVerified !== undefined
          ? { emailVerified: input.emailVerified }
          : {}),
        ...(input.phoneVerified !== undefined
          ? { phoneVerified: input.phoneVerified }
          : {}),
        updatedAt: now,
      },
    });

  const [{ adminCount }] = await db
    .select({ adminCount: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.role, "admin")));

  let effectiveRole = input.role ?? "user";

  if (adminCount === 0) {
    await db
      .update(users)
      .set({ role: "admin", updatedAt: now })
      .where(eq(users.id, input.id));
    effectiveRole = "admin";
  } else if (input.role) {
    effectiveRole = input.role;
  } else {
    const [row] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, input.id))
      .limit(1);
    effectiveRole = row?.role ?? "user";
  }

  await syncAuthUserRole(input.id, effectiveRole);

  if (input.emailVerified !== undefined) {
    await syncAuthEmailVerified(input.id, input.emailVerified);
  }

  await ensureUserSettingsRow({
    userId: input.id,
    tenantId,
  });
}
