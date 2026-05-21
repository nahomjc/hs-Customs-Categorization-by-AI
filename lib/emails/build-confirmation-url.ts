import type { SendEmailHookEmailData } from "@/lib/emails/types";

/** Maps hook action to Supabase `/auth/v1/verify` type (signup uses `email`). */
export function mapVerifyType(emailActionType: string): string {
  if (emailActionType === "signup") return "email";
  return emailActionType;
}

export function buildConfirmationUrl(
  supabaseUrl: string,
  emailData: Pick<
    SendEmailHookEmailData,
    "token_hash" | "email_action_type" | "redirect_to"
  >
): string {
  const base = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/verify`;
  const params = new URLSearchParams({
    token: emailData.token_hash,
    type: mapVerifyType(emailData.email_action_type),
    redirect_to: emailData.redirect_to,
  });
  return `${base}?${params.toString()}`;
}
