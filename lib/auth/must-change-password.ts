export const SET_PASSWORD_PATH = "/welcome/set-password";

export function mustChangePasswordFromMeta(
  meta: unknown
): boolean {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return false;
  }
  return (meta as Record<string, unknown>).must_change_password === true;
}
