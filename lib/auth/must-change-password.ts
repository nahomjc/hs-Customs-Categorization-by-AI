import type { User } from "@supabase/supabase-js";

export const SET_PASSWORD_PATH = "/welcome/set-password";

export function mustChangePassword(user: User | null | undefined): boolean {
  return user?.user_metadata?.must_change_password === true;
}
