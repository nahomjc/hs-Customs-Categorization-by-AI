import { NextResponse } from "next/server";
import { inviteDashboardUser } from "@/lib/dashboard/invite-user";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    email?: string;
    password?: string;
    fullName?: string;
    phone?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fullName = String(body.fullName ?? "").trim();
  const phone = String(body.phone ?? "").trim();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!fullName) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  try {
    const { userId, resent } = await inviteDashboardUser({
      email,
      password,
      fullName,
      phone,
    });
    return NextResponse.json({
      ok: true,
      userId,
      resent,
      message: resent
        ? "User already existed in auth — password updated and invite email resent."
        : "User created and invite email sent.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invite failed";
    if (/BREVO_API_KEY|BREVO_SENDER_EMAIL/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Email is not configured. Add BREVO_API_KEY and BREVO_SENDER_EMAIL to your environment.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
