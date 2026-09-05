import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authUser } from "@/db/schema/auth";
import { users } from "@/db/schema/users";
import { getAuthUser } from "@/lib/auth/session";

export async function PATCH(request: Request) {
  const user = await getAuthUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { fullName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fullName =
    body.fullName !== undefined
      ? String(body.fullName).trim() || null
      : undefined;

  if (fullName === undefined) {
    return NextResponse.json(
      { error: "fullName is required" },
      { status: 400 },
    );
  }

  if (fullName && fullName.length > 255) {
    return NextResponse.json(
      { error: "Full name is too long" },
      { status: 400 },
    );
  }

  const now = new Date();

  await db
    .update(users)
    .set({
      fullName,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));

  await db
    .update(authUser)
    .set({
      name: fullName || user.email || "User",
      updatedAt: now,
    })
    .where(eq(authUser.id, user.id));

  return NextResponse.json({ ok: true, fullName });
}
