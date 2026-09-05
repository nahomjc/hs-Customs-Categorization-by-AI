import { headers } from "next/headers";

import { ensureUserProfile } from "@/lib/auth/ensure-profile";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { auth } from "@/lib/auth/better-auth";
import { getAppOrigin } from "@/lib/auth/redirect-origin";
import { setMustChangePassword } from "@/lib/auth/password-policy";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { syncAuthUserRole } from "@/lib/auth/sync-auth-role";
import { inviteUserEmail } from "@/lib/emails/templates/invite-user";
import { sendViaBrevo } from "@/lib/emails/send-via-brevo";
import { getTenantChannelSettings } from "@/lib/notifications/channel-settings";
import { sendSmsEthiopia } from "@/lib/notifications/sms-ethiopia";

export type InviteUserInput = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  tenantId?: string;
  role?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
};

export type InviteDeliveryChannel = "sms" | "email";

export type InviteUserResult = {
  userId: string;
  resent: boolean;
  deliveredVia: InviteDeliveryChannel;
  smsError?: string | null;
};

async function sendInviteEmail(params: {
  email: string;
  loginUrl: string;
}) {
  const message = inviteUserEmail({
    siteUrl: getAppOrigin(),
    confirmationUrl: params.loginUrl,
    email: params.email,
  });

  await sendViaBrevo({
    to: params.email,
    subject: message.subject,
    html: message.html.replace(
      params.loginUrl,
      `${params.loginUrl}?email=${encodeURIComponent(params.email)}`,
    ),
  });
}

function buildInviteSmsText(params: {
  fullName: string;
  email: string;
  password: string;
  loginUrl: string;
}) {
  const text =
    `Impact Logistics invite for ${params.fullName}: ` +
    `Login ${params.loginUrl} Email ${params.email} Temp password ${params.password}. ` +
    `Change password after first sign-in.`;
  return text.slice(0, 320);
}

export async function inviteDashboardUser(
  input: InviteUserInput,
): Promise<InviteUserResult> {
  const tenantId = input.tenantId ?? DEFAULT_TENANT_ID;
  const requestHeaders = await headers();
  let resent = false;
  let userId: string;

  // Better Auth createUser checks auth `user.role`, not app `users.role`.
  const session = await getSessionUserProfile();
  if (session?.authUser?.id && session.profile?.role === "admin") {
    await syncAuthUserRole(session.authUser.id, "admin");
  }

  try {
    const created = await auth.api.createUser({
      body: {
        email: input.email,
        password: input.password,
        name: input.fullName,
        role: "user",
        data: {
          emailVerified: Boolean(input.emailVerified),
        },
      },
      headers: requestHeaders,
    });

    if (!created?.user?.id) {
      throw new Error("Could not create invitation for this email");
    }

    userId = created.user.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already|exists|registered/i.test(message)) {
      throw error;
    }

    resent = true;

    const listed = await auth.api.listUsers({
      query: { searchValue: input.email, searchField: "email", limit: 1 },
      headers: requestHeaders,
    });

    const existing = listed?.users?.find(
      (user) => user.email?.toLowerCase() === input.email.toLowerCase(),
    );

    if (!existing?.id) {
      throw new Error(
        "This email is registered but could not be loaded. Try a different email or contact support.",
      );
    }

    userId = existing.id;

    await auth.api.setUserPassword({
      body: {
        userId,
        newPassword: input.password,
      },
      headers: requestHeaders,
    });
  }

  await ensureUserProfile({
    id: userId,
    email: input.email,
    fullName: input.fullName,
    phone: input.phone,
    tenantId,
    role: input.role ?? "user",
    emailVerified: Boolean(input.emailVerified),
    phoneVerified: Boolean(input.phoneVerified),
  });

  await setMustChangePassword(userId);

  const loginUrl = `${getAppOrigin()}/login`;
  const channels = await getTenantChannelSettings(tenantId);

  let smsError: string | null = null;
  let smsSent = false;

  if (channels.smsEthiopiaApiKey && input.phone) {
    try {
      const smsResult = await sendSmsEthiopia({
        apiKey: channels.smsEthiopiaApiKey,
        phone: input.phone,
        text: buildInviteSmsText({
          fullName: input.fullName,
          email: input.email,
          password: input.password,
          loginUrl,
        }),
      });
      if (smsResult.ok) {
        smsSent = true;
      } else {
        smsError = smsResult.error ?? "SMS send failed";
        console.warn("Invite SMS failed, falling back to email:", smsError);
      }
    } catch (error) {
      smsError =
        error instanceof Error ? error.message : "SMS send failed unexpectedly";
      console.warn("Invite SMS threw, falling back to email:", smsError);
    }
  } else if (!channels.smsEthiopiaApiKey) {
    smsError = "SMS not configured";
  }

  if (smsSent) {
    return {
      userId,
      resent,
      deliveredVia: "sms",
      smsError: null,
    };
  }

  await sendInviteEmail({ email: input.email, loginUrl });

  return {
    userId,
    resent,
    deliveredVia: "email",
    smsError,
  };
}
