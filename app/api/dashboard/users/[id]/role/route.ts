import { NextResponse } from "next/server";
import { updateUserRole } from "@/lib/dashboard/update-user-role";
import { isUserRole } from "@/lib/auth/roles";
import { requireAdmin } from "@/lib/auth/require-admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.error },
      { status: admin.status }
    );
  }

  const { id: targetUserId } = await context.params;

  let body: { role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const role = String(body.role ?? "").trim().toLowerCase();
  if (!isUserRole(role)) {
    return NextResponse.json(
      { error: "Role must be admin, assessor, or user" },
      { status: 400 }
    );
  }

  const result = await updateUserRole(targetUserId, role);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true, role });
}
