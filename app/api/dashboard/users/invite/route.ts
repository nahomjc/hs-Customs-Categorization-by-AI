import { NextResponse } from "next/server";
import { inviteDashboardUser } from "@/lib/dashboard/invite-user";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isUserRole, type UserRole } from "@/lib/auth/roles";
import { normalizeEthiopiaPhone } from "@/lib/notifications/phone";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  let body: {
    email?: string;
    password?: string;
    fullName?: string;
    phone?: string;
    role?: string;
    emailVerified?: boolean;
    phoneVerified?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fullName = String(body.fullName ?? "").trim();
  const phoneRaw = String(body.phone ?? "").trim();
  const role: UserRole =
    body.role && isUserRole(body.role) ? body.role : "user";
  const emailVerified = Boolean(body.emailVerified);
  const phoneVerified = Boolean(body.phoneVerified);

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!fullName) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }
  if (!phoneRaw) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }
  const phone = normalizeEthiopiaPhone(phoneRaw) ?? phoneRaw;
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  try {
    const { userId, resent, deliveredVia, smsError } = await inviteDashboardUser({
      email,
      password,
      fullName,
      phone,
      role,
      emailVerified,
      phoneVerified,
    });

    const base = resent
      ? "User already existed — password updated."
      : "User created.";

    const message =
      deliveredVia === "sms"
        ? `${base} Invite sent by SMS.`
        : smsError && smsError !== "SMS not configured"
          ? `${base} SMS failed (${smsError}); invite sent by email instead.`
          : `${base} Invite sent by email.`;

    return NextResponse.json({
      ok: true,
      userId,
      resent,
      deliveredVia,
      smsError: smsError ?? null,
      message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invite failed";
    if (/BREVO_API_KEY|BREVO_SENDER_EMAIL/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Email is not configured. Add BREVO_API_KEY and BREVO_SENDER_EMAIL to your environment.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
