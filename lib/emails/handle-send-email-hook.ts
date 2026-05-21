import { Webhook } from "standardwebhooks";

import { buildConfirmationUrl } from "@/lib/emails/build-confirmation-url";
import { sendViaBrevo } from "@/lib/emails/send-via-brevo";
import {
  isNotificationOnlyAction,
  resolveAuthEmail,
} from "@/lib/emails/templates";
import type { SendEmailHookPayload } from "@/lib/emails/types";
import {
  getAppOrigin,
  normalizeAuthRedirectTo,
} from "@/lib/auth/redirect-origin";

function getHookSecret(): string {
  const raw = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!raw) {
    throw new Error("SEND_EMAIL_HOOK_SECRET is not configured");
  }
  return raw.replace(/^v1,whsec_/, "");
}

export async function handleSendEmailHook(
  rawBody: string,
  headers: Record<string, string>
): Promise<void> {
  const wh = new Webhook(getHookSecret());
  const payload = wh.verify(rawBody, headers) as SendEmailHookPayload;
  const { user, email_data: emailData } = payload;

  if (isNotificationOnlyAction(emailData.email_action_type)) {
    return;
  }

  const siteUrl = getAppOrigin();
  const redirectTo = normalizeAuthRedirectTo(emailData.redirect_to, siteUrl);
  const confirmationUrl = buildConfirmationUrl({
    ...emailData,
    redirect_to: redirectTo,
  }, siteUrl);

  const message = resolveAuthEmail(emailData.email_action_type, {
    siteUrl,
    confirmationUrl,
    email: user.email,
  });

  if (!message) {
    console.warn(
      `[send-email-hook] No template for action: ${emailData.email_action_type}`
    );
    return;
  }

  await sendViaBrevo({
    to: user.email,
    subject: message.subject,
    html: message.html,
  });
}
