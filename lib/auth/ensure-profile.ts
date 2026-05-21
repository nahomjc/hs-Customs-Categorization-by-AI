import { db } from "@/db";
import { users } from "@/db/schema/users";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";

export async function ensureUserProfile(input: {
  id: string;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  tenantId?: string;
}) {
  const tenantId = input.tenantId ?? DEFAULT_TENANT_ID;
  const now = new Date();

  await db
    .insert(users)
    .values({
      id: input.id,
      tenantId,
      email: input.email,
      fullName: input.fullName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: input.email,
        fullName: input.fullName ?? null,
        avatarUrl: input.avatarUrl ?? null,
        updatedAt: now,
      },
    });
}
