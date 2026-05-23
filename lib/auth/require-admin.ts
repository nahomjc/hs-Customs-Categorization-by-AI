import { db } from "@/db";
import { users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { eq } from "drizzle-orm";

export async function getSessionUserProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) return null;

  const [profile] = await db
    .select({
      id: users.id,
      role: users.role,
      tenantId: users.tenantId,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!profile) return { authUser: user, profile: null };

  return { authUser: user, profile };
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
