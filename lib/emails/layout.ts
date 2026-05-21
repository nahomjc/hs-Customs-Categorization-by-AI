import type { AuthEmailTemplateInput } from "@/lib/emails/types";

export type AuthEmailLayoutOptions = AuthEmailTemplateInput & {
  preheader: string;
  eyebrow: string;
  heading: string;
  bodyHtml: string;
  ctaLabel: string;
  footerNote: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Shared branded shell for all auth emails (table layout for clients). */
export function renderAuthEmailLayout(options: AuthEmailLayoutOptions): string {
  const siteUrl = escapeHtml(options.siteUrl);
  const confirmationUrl = escapeHtml(options.confirmationUrl);
  const email = escapeHtml(options.email);
  const preheader = escapeHtml(options.preheader);
  const eyebrow = escapeHtml(options.eyebrow);
  const heading = escapeHtml(options.heading);
  const ctaLabel = escapeHtml(options.ctaLabel);
  const footerNote = escapeHtml(options.footerNote);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <a href="${siteUrl}" style="text-decoration:none;display:inline-block;">
                <p style="margin:0;font-size:26px;font-weight:700;letter-spacing:0.14em;color:#111827;line-height:1;">IMPACT</p>
                <p style="margin:6px 0 0;font-size:11px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:#6b7280;line-height:1;">Logistics</p>
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="height:4px;background-color:#007bff;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:40px 32px 32px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#007bff;">${eyebrow}</p>
                    <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;color:#111827;">${heading}</h1>
                    ${options.bodyHtml}
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td align="center" style="padding:8px 0 28px;">
                          <a href="${confirmationUrl}" style="display:inline-block;background-color:#007bff;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">${ctaLabel}</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#6b7280;">Or copy and paste this link into your browser:</p>
                    <p style="margin:0 0 28px;font-size:13px;line-height:1.5;word-break:break-all;">
                      <a href="${confirmationUrl}" style="color:#007bff;text-decoration:underline;">${confirmationUrl}</a>
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;">
                      <tr>
                        <td style="padding:16px 18px;">
                          <p style="margin:0;font-size:13px;line-height:1.55;color:#6b7280;">${footerNote}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 8px 0;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#9ca3af;">Impact Logistics · AI-powered HS code grouping</p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
                <a href="${siteUrl}" style="color:#6b7280;text-decoration:underline;">Visit our website</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
