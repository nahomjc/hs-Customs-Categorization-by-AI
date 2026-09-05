import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { updateUserVerificationFlags } from "@/lib/dashboard/update-user-verification";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { id } = await params;

  let body: {
    emailVerified?: boolean;
    phoneVerified?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body.emailVerified !== "boolean" &&
    typeof body.phoneVerified !== "boolean"
  ) {
    return NextResponse.json(
      { error: "Provide emailVerified and/or phoneVerified" },
      { status: 400 },
    );
  }

  const result = await updateUserVerificationFlags({
    userId: id,
    emailVerified:
      typeof body.emailVerified === "boolean" ? body.emailVerified : undefined,
    phoneVerified:
      typeof body.phoneVerified === "boolean" ? body.phoneVerified : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
