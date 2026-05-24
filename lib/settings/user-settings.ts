import { db } from "@/db";
import { settings, users } from "@/db/schema";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { eq, or } from "drizzle-orm";
import {
  DEFAULT_PREFERENCES,
  mergePreferences,
  parsePreferences,
  type UserPreferences,
} from "./preferences";

export async function getPreferencesForUploader(
  uploadedBy: string
): Promise<UserPreferences> {
  try {
    const [userRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.id, uploadedBy), eq(users.email, uploadedBy)))
      .limit(1);
    if (userRow) return getUserPreferences(userRow.id);
  } catch {
    // ignore
  }
  return { ...DEFAULT_PREFERENCES };
}

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  try {
    const [row] = await db
      .select({ preferences: settings.preferences })
      .from(settings)
      .where(eq(settings.userId, userId))
      .limit(1);

    if (row?.preferences) {
      return parsePreferences(row.preferences);
    }
  } catch {
    // fall through to legacy meta
  }

  try {
    const [userRow] = await db
      .select({ meta: users.meta })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return parsePreferences(userRow?.meta ?? {});
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function ensureUserSettingsRow(input: {
  userId: string;
  tenantId?: string;
  preferences?: UserPreferences;
}): Promise<void> {
  const tenantId = input.tenantId ?? DEFAULT_TENANT_ID;
  const preferences = input.preferences ?? DEFAULT_PREFERENCES;

  await db
    .insert(settings)
    .values({
      tenantId,
      userId: input.userId,
      preferences,
    })
    .onConflictDoUpdate({
      target: settings.userId,
      set: {
        tenantId,
        updatedAt: new Date(),
      },
    });
}

export async function upsertUserPreferences(
  userId: string,
  tenantId: string,
  patch: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await getUserPreferences(userId);
  const preferences = mergePreferences(current, patch);

  await db
    .insert(settings)
    .values({
      tenantId,
      userId,
      preferences,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.userId,
      set: {
        preferences,
        tenantId,
        updatedAt: new Date(),
      },
    });

  return preferences;
}

export async function setUserPreferences(
  userId: string,
  tenantId: string,
  preferences: UserPreferences
): Promise<UserPreferences> {
  await db
    .insert(settings)
    .values({
      tenantId,
      userId,
      preferences,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.userId,
      set: {
        preferences,
        tenantId,
        updatedAt: new Date(),
      },
    });

  return preferences;
}
