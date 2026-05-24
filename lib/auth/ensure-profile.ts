import { db } from "@/db";
import { users } from "@/db/schema/users";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { ensureUserSettingsRow } from "@/lib/settings/user-settings";
import { and, eq, sql } from "drizzle-orm";

export async function ensureUserProfile(input: {
  id: string;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  tenantId?: string;
}) {
  const tenantId = input.tenantId ?? DEFAULT_TENANT_ID;
  const now = new Date();
  const phone =
    input.phone != null && String(input.phone).trim() !== ""
      ? String(input.phone).trim()
      : null;

  await db
    .insert(users)
    .values({
      id: input.id,
      tenantId,
      email: input.email,
      fullName: input.fullName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      meta: phone ? { phone } : {},
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: input.email,
        fullName: input.fullName ?? null,
        avatarUrl: input.avatarUrl ?? null,
        ...(phone ? { meta: { phone } } : {}),
        updatedAt: now,
      },
    });

  const [{ adminCount }] = await db
    .select({ adminCount: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.role, "admin")));

  if (adminCount === 0) {
    await db
      .update(users)
      .set({ role: "admin", updatedAt: now })
      .where(eq(users.id, input.id));
  }

  await ensureUserSettingsRow({
    userId: input.id,
    tenantId,
  });
}
