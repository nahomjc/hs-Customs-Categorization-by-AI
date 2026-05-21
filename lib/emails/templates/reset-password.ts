import { renderAuthEmailLayout } from "@/lib/emails/layout";
import type { AuthEmailMessage, AuthEmailTemplateInput } from "@/lib/emails/types";

export function resetPasswordEmail(
  input: AuthEmailTemplateInput
): AuthEmailMessage {
  const safeEmail = input.email
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;");

  const html = renderAuthEmailLayout({
    ...input,
    preheader: "Reset your Impact Logistics password — link expires soon.",
    eyebrow: "Password reset",
    heading: "Reset your password",
    bodyHtml: `<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4b5563;">
      We received a request to reset the password for <strong style="color:#111827;">${safeEmail}</strong>.
      Click the button below to choose a new password.
    </p>`,
    ctaLabel: "Reset password",
    footerNote:
      "If you did not request a password reset, ignore this email. Your password will not change.",
  });

  return {
    subject: "Reset your Impact Logistics password",
    html,
  };
}
