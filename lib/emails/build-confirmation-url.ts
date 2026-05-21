import {
  getAppOrigin,
  normalizeAuthRedirectTo,
} from "@/lib/auth/redirect-origin";
import type { SendEmailHookEmailData } from "@/lib/emails/types";

/** Maps hook action to `verifyOtp` type (signup uses `email`). */
export function mapVerifyType(emailActionType: string): string {
  if (emailActionType === "signup") return "email";
  return emailActionType;
}

/**
 * Link straight to the app callback (not supabase.co/auth/v1/verify).
 * PKCE signup tokens often 500 on the hosted verify endpoint; our callback uses verifyOtp.
 */
export function buildConfirmationUrl(
  emailData: Pick<
    SendEmailHookEmailData,
    "token_hash" | "email_action_type" | "redirect_to"
  >,
  appOrigin: string = getAppOrigin()
): string {
  const callbackUrl = new URL(
    normalizeAuthRedirectTo(emailData.redirect_to, appOrigin)
  );

  callbackUrl.searchParams.set("token_hash", emailData.token_hash);
  callbackUrl.searchParams.set("type", mapVerifyType(emailData.email_action_type));

  return callbackUrl.toString();
}
