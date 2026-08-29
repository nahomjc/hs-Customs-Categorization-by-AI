import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";

import { db } from "@/db";
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
} from "@/db/schema/auth";
import { getAppOrigin } from "@/lib/auth/redirect-origin";
import { confirmSignupEmail } from "@/lib/emails/templates/confirm-signup";
import { resetPasswordEmail } from "@/lib/emails/templates/reset-password";
import { sendViaBrevo } from "@/lib/emails/send-via-brevo";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? "development-secret-change-me-in-production",
  baseURL: process.env.BETTER_AUTH_URL ?? getAppOrigin(),
  trustedOrigins: [getAppOrigin()],
  advanced: {
    database: {
      // App-generated UUIDs (not DB default). "uuid" string mode skips generation when the adapter supports UUIDs.
      generateId: () => crypto.randomUUID(),
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    sendResetPassword: async ({ user, url }) => {
      const message = resetPasswordEmail({
        siteUrl: getAppOrigin(),
        confirmationUrl: url,
        email: user.email,
      });
      await sendViaBrevo({
        to: user.email,
        subject: message.subject,
        html: message.html,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const message = confirmSignupEmail({
        siteUrl: getAppOrigin(),
        confirmationUrl: url,
        email: user.email,
      });
      try {
        await sendViaBrevo({
          to: user.email,
          subject: message.subject,
          html: message.html,
        });
        console.info(`[auth] Verification email sent to ${user.email}`);
      } catch (error) {
        console.error(`[auth] Failed to send verification email to ${user.email}`, error);
        throw error;
      }
    },
  },
  plugins: [admin()],
});

export type AuthSession = typeof auth.$Infer.Session;
