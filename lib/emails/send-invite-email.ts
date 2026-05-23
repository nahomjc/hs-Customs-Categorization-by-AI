import { buildConfirmationUrl } from "@/lib/emails/build-confirmation-url";
import { inviteUserEmail } from "@/lib/emails/templates/invite-user";
import { sendViaBrevo } from "@/lib/emails/send-via-brevo";
import { getAppOrigin } from "@/lib/auth/redirect-origin";

export async function sendInviteAuthEmail(params: {
  email: string;
  tokenHash: string;
  redirectTo: string;
  emailActionType?: string;
}): Promise<void> {
  const siteUrl = getAppOrigin();
  const actionType = params.emailActionType ?? "invite";

  const confirmationUrl = buildConfirmationUrl(
    {
      token_hash: params.tokenHash,
      email_action_type: actionType,
      redirect_to: params.redirectTo,
    },
    siteUrl
  );

  const message = inviteUserEmail({
    siteUrl,
    confirmationUrl,
    email: params.email,
  });

  await sendViaBrevo({
    to: params.email,
    subject: message.subject,
    html: message.html,
  });
}
