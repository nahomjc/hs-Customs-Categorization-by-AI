import { renderAuthEmailLayout } from "@/lib/emails/layout";
import type { AuthEmailMessage, AuthEmailTemplateInput } from "@/lib/emails/types";

export function inviteUserEmail(input: AuthEmailTemplateInput): AuthEmailMessage {
  const safeEmail = input.email
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;");
  const loginUrl = `${input.siteUrl.replace(/\/$/, "")}/login`;

  const html = renderAuthEmailLayout({
    ...input,
    preheader: "You have been invited to Impact Logistics.",
    eyebrow: "Team invitation",
    heading: "Accept your invitation",
    bodyHtml: `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#4b5563;">
      You have been invited to join <strong style="color:#111827;">Impact Logistics</strong> as
      <strong style="color:#111827;">${safeEmail}</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563;">
      Your administrator set a password for this account. After accepting, sign in at
      <a href="${loginUrl}" style="color:#007bff;text-decoration:underline;">${loginUrl}</a>
      with your email and that password.
    </p>`,
    ctaLabel: "Accept invitation",
    footerNote:
      "If you were not expecting this invitation, you can ignore this email.",
  });

  return {
    subject: "You are invited to Impact Logistics",
    html,
  };
}
