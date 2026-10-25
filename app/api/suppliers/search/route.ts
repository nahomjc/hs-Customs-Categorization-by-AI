import { NextRequest, NextResponse } from "next/server";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { isStaffRole } from "@/lib/auth/roles";
import { getAuthUser } from "@/lib/auth/session";
import { unauthorizedResponse } from "@/lib/import-cases/api-helpers";
import { getTenantId } from "@/lib/import-cases/queries";
import { searchSuppliers } from "@/lib/suppliers/queries";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const session = await getSessionUserProfile();
  if (!isStaffRole(session?.profile?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? undefined;
  const items = await searchSuppliers({
    tenantId: getTenantId(),
    query: q,
  });

  return NextResponse.json({ items });
}
