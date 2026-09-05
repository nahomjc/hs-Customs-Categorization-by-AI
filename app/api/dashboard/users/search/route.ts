import { NextRequest, NextResponse } from "next/server";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { isStaffRole } from "@/lib/auth/roles";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/import-cases/api-helpers";
import {
  getTenantId,
  searchTenantClients,
} from "@/lib/import-cases/queries";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const session = await getSessionUserProfile();
  if (!isStaffRole(session?.profile?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = request.nextUrl.searchParams.get("role") ?? "client";
  if (role !== "client") {
    return NextResponse.json(
      { error: "Only role=client search is supported" },
      { status: 400 },
    );
  }

  const q = request.nextUrl.searchParams.get("q") ?? undefined;
  const items = await searchTenantClients({
    tenantId: getTenantId(),
    query: q,
  });

  return NextResponse.json({ items });
}
