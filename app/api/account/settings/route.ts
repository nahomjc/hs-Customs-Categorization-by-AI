import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  type UserPreferences,
} from "@/lib/auth/settings-meta";
import { createClient } from "@/lib/supabase/server";
import { eq } from "drizzle-orm";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    .select({ meta: users.meta, fullName: users.fullName })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const existingMeta =
    row?.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
      ? (row.meta as Record<string, unknown>)
      : {};

  const currentPrefs = parsePreferences(existingMeta);
  const preferences: UserPreferences = {
    ...DEFAULT_PREFERENCES,
    ...currentPrefs,
    ...(body.preferences ?? {}),
  };

  if (body.preferences?.defaultExportFormat !== undefined) {
    preferences.defaultExportFormat =
      body.preferences.defaultExportFormat === "csv" ? "csv" : "xlsx";
  }

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

    await supabase.auth.updateUser({
      data: {
        full_name: fullName ?? undefined,
        name: fullName ?? undefined,
      },
    });
  } catch (err) {
    console.error("[settings PATCH]", err);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, fullName, preferences });
}
