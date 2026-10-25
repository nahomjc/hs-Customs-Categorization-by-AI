import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isDemoRequestStatus } from "@/lib/demo-requests/constants";
import { updateDemoRequestStatus } from "@/lib/demo-requests/queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = String(body.status ?? "").trim();
  if (!isDemoRequestStatus(status)) {
    return NextResponse.json(
      { error: "Invalid status. Use new, contacted, scheduled, or closed." },
      { status: 400 },
    );
  }

  try {
    const row = await updateDemoRequestStatus(id, status);
    if (!row) {
      return NextResponse.json({ error: "Demo request not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item: row });
  } catch (err) {
    console.error("[demo-requests PATCH]", err);
    return NextResponse.json(
      { error: "Could not update demo request." },
      { status: 500 },
    );
  }
}
