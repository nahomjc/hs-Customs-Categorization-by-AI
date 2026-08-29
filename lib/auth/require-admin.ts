import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthUser } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

export type AuthUserLike = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

export async function getSessionUserProfile() {
  const user = await getAuthUser();

  if (!user?.id) return null;

  const [profile] = await db
    .select({
      id: users.id,
      role: users.role,
      tenantId: users.tenantId,
      meta: users.meta,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const authUser: AuthUserLike = {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  };

  if (!profile) return { authUser, profile: null };

  return { authUser, profile };
}

export async function requireAdmin() {
  const session = await getSessionUserProfile();
  if (!session) {
    return { ok: false as const, status: 401 as const, error: "Unauthorized" };
  }
  if (!session.profile) {
    return { ok: false as const, status: 403 as const, error: "Profile not found" };
  }
  if (session.profile.role !== "admin") {
    return { ok: false as const, status: 403 as const, error: "Admin access required" };
  }
  return { ok: true as const, session };
}
