import type { User } from "@supabase/supabase-js";
import type { UserMenuUser } from "@/components/auth/UserMenu";

export function toUserMenuUser(user: User): UserMenuUser {
  return {
    email: user.email ?? "",
    name:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined),
    avatarUrl:
      (user.user_metadata?.avatar_url as string | undefined) ??
      (user.user_metadata?.picture as string | undefined) ??
      null,
  };
}
