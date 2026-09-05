import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { isStaffRole } from "@/lib/auth/roles";
import { getTenantChannelSettings } from "@/lib/notifications/channel-settings";
import { normalizeEthiopiaPhone } from "@/lib/notifications/phone";
import { parseSmsStatusCommand } from "@/lib/notifications/sms-ethiopia";
import { TRACKING_STATUS_LABELS } from "@/lib/tracking/constants";
import { updateTrackingStatus } from "@/lib/tracking/update-tracking-status";

/**
 * Inbound SMS adapter for SMS Ethiopia (and compatible MO webhooks).
 * Accepts flexible payloads: { msisdn|from|phone, text|message|body }.
 */
export async function POST(request: NextRequest) {
  const tenantId = DEFAULT_TENANT_ID;
  const settings = await getTenantChannelSettings(tenantId);

  if (!settings.smsEnabled) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawPhone = String(
    body.msisdn ?? body.from ?? body.phone ?? body.sender ?? "",
  ).trim();
  const text = String(
    body.text ?? body.message ?? body.body ?? body.sms ?? "",
  ).trim();

  const phone = normalizeEthiopiaPhone(rawPhone);
  if (!phone || !text) {
    return NextResponse.json(
      { error: "msisdn and text are required" },
      { status: 400 },
    );
  }

  const allowlist = settings.authorizedStaffPhones.map(
    (p) => normalizeEthiopiaPhone(p) ?? p,
  );
  if (!allowlist.includes(phone)) {
    return NextResponse.json({ error: "Phone not authorized" }, { status: 403 });
  }

  const parsed = parseSmsStatusCommand(text);
  if (!parsed) {
    return NextResponse.json({
      ok: false,
      error: "Expected: STATUS CASE_NUMBER STATUS [note]",
    });
  }

  const [actor] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.tenantId, tenantId),
        eq(users.phone, phone),
        eq(users.status, "active"),
      ),
    )
    .limit(1);

  if (actor && !isStaffRole(actor.role)) {
    return NextResponse.json({ error: "Not a staff user" }, { status: 403 });
  }

  const result = await updateTrackingStatus({
    tenantId,
    caseNumber: parsed.caseNumber,
    status: parsed.status,
    note: parsed.note,
    source: "sms",
    actorUserId: actor?.id ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    caseNumber: result.caseNumber,
    status: result.status,
    label: TRACKING_STATUS_LABELS[result.status],
  });
}
