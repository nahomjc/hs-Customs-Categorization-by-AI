import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/lib/auth/ensure-profile";
import { getAppOrigin } from "@/lib/auth/constants";
import {
  mustChangePassword,
  SET_PASSWORD_PATH,
} from "@/lib/auth/must-change-password";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash") ?? searchParams.get("token");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";
  const origin = getAppOrigin();

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`,
      );
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`,
      );
    }
  } else {
    return NextResponse.redirect(`${origin}/login?error=missing_auth_code`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    try {
      await ensureUserProfile({
        id: user.id,
        email: user.email,
        fullName:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null,
        avatarUrl:
          (user.user_metadata?.avatar_url as string | undefined) ?? null,
      });
    } catch (err) {
      console.error("ensureUserProfile failed:", err);
    }
  }

  let safeNext = next.startsWith("/") ? next : "/dashboard";
  if (mustChangePassword(user)) {
    safeNext = SET_PASSWORD_PATH;
  }
  return NextResponse.redirect(`${origin}${safeNext}`);
}
