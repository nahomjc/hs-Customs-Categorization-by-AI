import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { canAccessPersonalShipments } from "@/lib/auth/roles";
import { getAuthUser } from "@/lib/auth/session";
import {
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/import-cases/api-helpers";
import { markNotificationRead } from "@/lib/notifications/client-inbox";

type RouteParams = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  read: z.boolean().default(true),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const session = await getSessionUserProfile();
  if (!canAccessPersonalShipments(session?.profile?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const item = await markNotificationRead(user.id, id, parsed.data.read);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}
