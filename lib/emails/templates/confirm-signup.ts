import { renderAuthEmailLayout } from "@/lib/emails/layout";
import type { AuthEmailMessage, AuthEmailTemplateInput } from "@/lib/emails/types";

export function confirmSignupEmail(
  input: AuthEmailTemplateInput
): AuthEmailMessage {
  const html = renderAuthEmailLayout({
    ...input,
    preheader: "Confirm your Impact Logistics account — one click to get started.",
    eyebrow: "Account verification",
    heading: "Confirm your email",
    bodyHtml: `<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4b5563;">
      Thanks for signing up for <strong style="color:#111827;">Impact Logistics</strong>. Please confirm
      <strong style="color:#111827;">${input.email.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</strong>
      to activate your account and start categorizing customs documents.
    </p>`,
    ctaLabel: "Confirm email address",
    footerNote:
      "This link expires soon for your security. If you did not create an account, you can safely ignore this email.",
  });

  return {
    subject: "Confirm your Impact Logistics account",
    html,
  };
}
