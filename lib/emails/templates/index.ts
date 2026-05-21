import { confirmSignupEmail } from "@/lib/emails/templates/confirm-signup";
import { magicLinkEmail } from "@/lib/emails/templates/magic-link";
import { resetPasswordEmail } from "@/lib/emails/templates/reset-password";
import type { AuthEmailMessage, AuthEmailTemplateInput } from "@/lib/emails/types";

type TemplateBuilder = (input: AuthEmailTemplateInput) => AuthEmailMessage;

const templates: Record<string, TemplateBuilder> = {
  signup: confirmSignupEmail,
  recovery: resetPasswordEmail,
  magiclink: magicLinkEmail,
};

export function resolveAuthEmail(
  emailActionType: string,
  input: AuthEmailTemplateInput
): AuthEmailMessage | null {
  const builder = templates[emailActionType];
  if (!builder) return null;
  return builder(input);
}

export function isNotificationOnlyAction(emailActionType: string): boolean {
  return emailActionType.endsWith("_notification");
}
