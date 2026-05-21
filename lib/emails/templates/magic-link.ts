import { renderAuthEmailLayout } from "@/lib/emails/layout";
import type { AuthEmailMessage, AuthEmailTemplateInput } from "@/lib/emails/types";

export function magicLinkEmail(input: AuthEmailTemplateInput): AuthEmailMessage {
  const safeEmail = input.email
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;");

  const html = renderAuthEmailLayout({
    ...input,
    preheader: "Your secure sign-in link for Impact Logistics.",
    eyebrow: "Secure sign-in",
    heading: "Your sign-in link",
    bodyHtml: `<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4b5563;">
      Click below to sign in to Impact Logistics as <strong style="color:#111827;">${safeEmail}</strong>.
    </p>`,
    ctaLabel: "Sign in",
    footerNote: "If you did not request this link, you can safely ignore this email.",
  });

  return {
    subject: "Sign in to Impact Logistics",
    html,
  };
}
