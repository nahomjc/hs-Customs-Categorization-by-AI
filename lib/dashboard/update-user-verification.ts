import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authUser } from "@/db/schema/auth";
import { users } from "@/db/schema/users";

export async function syncAuthEmailVerified(
  userId: string,
  emailVerified: boolean,
): Promise<void> {
  await db
    .update(authUser)
    .set({ emailVerified, updatedAt: new Date() })
    .where(eq(authUser.id, userId));
}

export async function updateUserVerificationFlags(params: {
  userId: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "User not found" };
  }

  const patch: {
    emailVerified?: boolean;
    phoneVerified?: boolean;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (typeof params.emailVerified === "boolean") {
    patch.emailVerified = params.emailVerified;
  }
  if (typeof params.phoneVerified === "boolean") {
    patch.phoneVerified = params.phoneVerified;
  }

  await db.update(users).set(patch).where(eq(users.id, params.userId));

  if (typeof params.emailVerified === "boolean") {
    await syncAuthEmailVerified(params.userId, params.emailVerified);
  }

  return { ok: true };
}
