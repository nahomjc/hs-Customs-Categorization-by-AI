import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  clampPreferencesForRole,
  mergePreferences,
  type UserPreferences,
} from "@/lib/auth/settings-meta";
import { getAuthUser } from "@/lib/auth/session";
import {
  getUserPreferences,
  setUserPreferences,
} from "@/lib/settings/user-settings";
import { eq } from "drizzle-orm";

export async function GET() {
  const user = await getAuthUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profile] = await db
    .select({ role: users.role, tenantId: users.tenantId })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const preferences = clampPreferencesForRole(
    await getUserPreferences(user.id),
    profile?.role
  );

  return NextResponse.json({ preferences });
}

export async function PATCH(request: Request) {
  const user = await getAuthUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    fullName?: string;
    preferences?: Partial<UserPreferences>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const [row] = await db
    .select({
      meta: users.meta,
      fullName: users.fullName,
      role: users.role,
      tenantId: users.tenantId,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const tenantId = row?.tenantId ?? "default";
  let preferences = await getUserPreferences(user.id);

  if (body.preferences) {
    preferences = clampPreferencesForRole(
      mergePreferences(preferences, body.preferences),
      row?.role
    );
    await setUserPreferences(user.id, tenantId, preferences);
  }

  const existingMeta =
    row?.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
      ? (row.meta as Record<string, unknown>)
      : {};

  const fullName =
    body.fullName !== undefined
      ? body.fullName.trim() || null
      : (row?.fullName ?? null);

  const meta = {
    ...existingMeta,
    preferences,
  };

  try {
    await db
      .update(users)
      .set({
        fullName,
        meta,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  } catch (err) {
    console.error("[settings PATCH]", err);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, fullName, preferences });
}
