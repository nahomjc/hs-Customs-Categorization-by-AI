import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authUser } from "@/db/schema/auth";
import { users } from "@/db/schema/users";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { getAuthUser } from "@/lib/auth/session";
import { removeObject, uploadObject } from "@/lib/storage/r2";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_BYTES = 2 * 1024 * 1024;

function avatarKey(userId: string, ext: string) {
  const tenantId = DEFAULT_TENANT_ID;
  return `${tenantId}/avatars/${userId}.${ext}`;
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Photo file is required" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Use a JPEG, PNG, WebP, or GIF image" },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Photo must be 2MB or smaller" },
      { status: 400 },
    );
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";

  const key = avatarKey(user.id, ext);
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await uploadObject(key, buffer, file.type);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const avatarUrl = `/api/avatars/${user.id}?v=${Date.now()}`;
  const now = new Date();

  const [existing] = await db
    .select({ meta: users.meta, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const meta =
    existing?.meta && typeof existing.meta === "object" && !Array.isArray(existing.meta)
      ? { ...(existing.meta as Record<string, unknown>) }
      : {};
  meta.avatarStorageKey = key;

  await db
    .update(users)
    .set({
      avatarUrl,
      meta,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));

  await db
    .update(authUser)
    .set({
      image: avatarUrl,
      updatedAt: now,
    })
    .where(eq(authUser.id, user.id));

  return NextResponse.json({ ok: true, avatarUrl });
}

export async function DELETE() {
  const user = await getAuthUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [existing] = await db
    .select({ meta: users.meta })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const meta =
    existing?.meta && typeof existing.meta === "object" && !Array.isArray(existing.meta)
      ? { ...(existing.meta as Record<string, unknown>) }
      : {};
  const key =
    typeof meta.avatarStorageKey === "string" ? meta.avatarStorageKey : null;

  if (key) {
    try {
      await removeObject(key);
    } catch {
      // ignore missing object
    }
    delete meta.avatarStorageKey;
  }

  const now = new Date();
  await db
    .update(users)
    .set({
      avatarUrl: null,
      meta,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));

  await db
    .update(authUser)
    .set({
      image: null,
      updatedAt: now,
    })
    .where(eq(authUser.id, user.id));

  return NextResponse.json({ ok: true });
}
