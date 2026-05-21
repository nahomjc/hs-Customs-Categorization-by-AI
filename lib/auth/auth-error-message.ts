type AuthErrorLike = {
  message?: string;
  code?: string;
  status?: number;
};

/** User-facing copy for common Supabase Auth API errors. */
export function getAuthErrorMessage(error: AuthErrorLike): string {
  const code = error.code ?? "";
  const message = error.message ?? "Something went wrong. Please try again.";

  switch (code) {
    case "over_email_send_rate_limit":
      return "Too many confirmation emails were sent recently. Wait about an hour, then try again—or ask your admin to raise the email rate limit in Supabase.";
    case "email_rate_limit_exceeded":
      return "Too many emails to this address. Please wait a few minutes before trying again.";
    case "signup_disabled":
      return "New signups are disabled for this app. Contact support if you need access.";
    case "user_already_exists":
      return "An account with this email already exists. Try signing in or reset your password.";
    case "email_address_invalid":
      return "That email address is not allowed. Use a valid work email or contact support.";
    case "weak_password":
      return "Choose a stronger password (at least 8 characters).";
    case "unexpected_failure":
      if (message.includes("hook") && message.includes("404")) {
        return "Signup email hook returned 404. Redeploy the app so /api/auth/hooks/send-email exists, point the Supabase Send Email hook at that URL, or disable the hook and use Supabase SMTP + email templates instead.";
      }
      return message;
    default:
      if (error.status === 429) {
        return "Too many attempts. Please wait a few minutes and try again.";
      }
      return message;
  }
}
