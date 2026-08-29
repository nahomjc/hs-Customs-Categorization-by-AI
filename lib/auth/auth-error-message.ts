type AuthErrorLike = {
  message?: string;
  code?: string;
  status?: number;
};

/** User-facing copy for common auth API errors. */
export function getAuthErrorMessage(error: AuthErrorLike): string {
  const code = error.code ?? "";
  const message = error.message ?? "Something went wrong. Please try again.";

  switch (code) {
    case "USER_ALREADY_EXISTS":
    case "user_already_exists":
      return "An account with this email already exists. Try signing in or reset your password.";
    case "INVALID_EMAIL":
    case "email_address_invalid":
      return "That email address is not allowed. Use a valid work email or contact support.";
    case "PASSWORD_TOO_SHORT":
    case "weak_password":
      return "Choose a stronger password (at least 8 characters).";
    default:
      if (/already exists|already registered/i.test(message)) {
        return "An account with this email already exists. Try signing in or reset your password.";
      }
      if (error.status === 429) {
        return "Too many attempts. Please wait a few minutes and try again.";
      }
      return message;
  }
}
