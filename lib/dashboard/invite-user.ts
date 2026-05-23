import type { User } from "@supabase/supabase-js";

import { ensureUserProfile } from "@/lib/auth/ensure-profile";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { getAppOrigin } from "@/lib/auth/redirect-origin";
import { sendInviteAuthEmail } from "@/lib/emails/send-invite-email";
import { createAdminClient } from "@/lib/supabase/admin";

export type InviteUserInput = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  tenantId?: string;
};

export type InviteUserResult = {
  userId: string;
  /** User already existed in Supabase Auth (e.g. failed invite earlier). */
  resent: boolean;
};

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<User | null> {
  let page = 1;
  const perPage = 200;

  while (page <= 25) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(error.message);
    }

    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (match) return match;

    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

function isAlreadyRegisteredMessage(message: string): boolean {
  return /already|exists|registered/i.test(message);
}

export async function inviteDashboardUser(
  input: InviteUserInput
): Promise<InviteUserResult> {
  const admin = createAdminClient();
  const tenantId = input.tenantId ?? DEFAULT_TENANT_ID;
  const redirectTo = `${getAppOrigin()}/auth/callback?next=/dashboard`;
  const metadata = {
    full_name: input.fullName,
    name: input.fullName,
    phone: input.phone,
    must_change_password: true,
  };

  let userId: string;
  let tokenHash: string;
  let emailActionType: string;
  let resent = false;

  const signupLink = await admin.auth.admin.generateLink({
    type: "signup",
    email: input.email,
    password: input.password,
    options: {
      redirectTo,
      data: metadata,
    },
  });

  if (
    !signupLink.error &&
    signupLink.data.properties?.hashed_token &&
    signupLink.data.user?.id
  ) {
    userId = signupLink.data.user.id;
    tokenHash = signupLink.data.properties.hashed_token;
    emailActionType = "signup";
  } else if (
    signupLink.error &&
    isAlreadyRegisteredMessage(signupLink.error.message)
  ) {
    resent = true;

    const magicLink = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: input.email,
      options: {
        redirectTo,
        data: metadata,
      },
    });

    if (magicLink.error) {
      throw new Error(magicLink.error.message);
    }

    tokenHash = magicLink.data.properties?.hashed_token ?? "";
    if (!tokenHash) {
      throw new Error("Could not generate sign-in link for this user");
    }

    userId =
      magicLink.data.user?.id ??
      (await findAuthUserByEmail(admin, input.email))?.id ??
      "";

    if (!userId) {
      throw new Error(
        "This email is registered in authentication but could not be loaded. Remove the user in Supabase → Authentication → Users, or use a different email."
      );
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: input.password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (updateError) {
      throw new Error(updateError.message);
    }

    emailActionType = "magiclink";
  } else {
    throw new Error(
      signupLink.error?.message ?? "Could not create invitation for this email"
    );
  }

  await sendInviteAuthEmail({
    email: input.email,
    tokenHash,
    redirectTo,
    emailActionType,
  });

  await ensureUserProfile({
    id: userId,
    email: input.email,
    fullName: input.fullName,
    phone: input.phone,
    tenantId,
  });

  return { userId, resent };
}
