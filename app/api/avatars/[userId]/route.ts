import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { downloadObject } from "@/lib/storage/r2";

type RouteParams = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { userId } = await params;

  const [row] = await db
    .select({
      avatarUrl: users.avatarUrl,
      meta: users.meta,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const meta =
    row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
      ? (row.meta as Record<string, unknown>)
      : {};

  const key =
    typeof meta.avatarStorageKey === "string"
      ? meta.avatarStorageKey
      : null;

  if (!key) {
    return NextResponse.json({ error: "No avatar" }, { status: 404 });
  }

  try {
    const buffer = await downloadObject(key);
    const ext = key.split(".").pop()?.toLowerCase();
    const contentType =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/jpeg";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Avatar unavailable" }, { status: 404 });
  }
}
