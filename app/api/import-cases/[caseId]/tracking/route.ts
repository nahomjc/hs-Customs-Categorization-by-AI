import { NextRequest, NextResponse } from "next/server";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { isStaffRole } from "@/lib/auth/roles";
import { getAuthUser } from "@/lib/auth/session";
import {
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/import-cases/api-helpers";
import { getTenantId } from "@/lib/import-cases/queries";
import { updateTrackingSchema } from "@/lib/import-cases/validation";
import { updateTrackingStatus } from "@/lib/tracking/update-tracking-status";

type RouteParams = { params: Promise<{ caseId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const session = await getSessionUserProfile();
  if (!isStaffRole(session?.profile?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { caseId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateTrackingSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const result = await updateTrackingStatus({
    tenantId: getTenantId(),
    importCaseId: caseId,
    status: parsed.data.trackingStatus,
    note: parsed.data.trackingNote,
    source: "web",
    actorUserId: user.id,
  });

  if (!result.ok) {
    const status = result.error.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
