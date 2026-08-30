import { headers } from "next/headers";

import { ensureUserProfile } from "@/lib/auth/ensure-profile";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { auth } from "@/lib/auth/better-auth";
import { getAppOrigin } from "@/lib/auth/redirect-origin";
import { setMustChangePassword } from "@/lib/auth/password-policy";
import { inviteUserEmail } from "@/lib/emails/templates/invite-user";
import { sendViaBrevo } from "@/lib/emails/send-via-brevo";

export type InviteUserInput = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  tenantId?: string;
};

export type InviteUserResult = {
  userId: string;
  resent: boolean;
};

export async function inviteDashboardUser(
  input: InviteUserInput
): Promise<InviteUserResult> {
  const tenantId = input.tenantId ?? DEFAULT_TENANT_ID;
  const requestHeaders = await headers();
  let resent = false;
  let userId: string;

  try {
    const created = await auth.api.createUser({
      body: {
        email: input.email,
        password: input.password,
        name: input.fullName,
        role: "user",
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
      (user) => user.email?.toLowerCase() === input.email.toLowerCase()
    );

    if (!existing?.id) {
      throw new Error(
        "This email is registered but could not be loaded. Try a different email or contact support."
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
  });

  await setMustChangePassword(userId);

  const loginUrl = `${getAppOrigin()}/login`;
  const message = inviteUserEmail({
    siteUrl: getAppOrigin(),
    confirmationUrl: loginUrl,
    email: input.email,
  });

  await sendViaBrevo({
    to: input.email,
    subject: message.subject,
    html: message.html.replace(
      loginUrl,
      `${loginUrl}?email=${encodeURIComponent(input.email)}`
    ),
  });

  return { userId, resent };
}
