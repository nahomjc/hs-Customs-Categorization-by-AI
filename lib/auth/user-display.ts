import type { AuthUserLike } from "@/lib/auth/require-admin";
import type { UserMenuUser } from "@/components/auth/UserMenu";

type ProfileDisplayFields = {
  fullName?: string | null;
  avatarUrl?: string | null;
};

export function toUserMenuUser(
  user: AuthUserLike,
  profile?: ProfileDisplayFields | null,
): UserMenuUser {
  const profileName = profile?.fullName?.trim();
  const authName = user.name?.trim();

  return {
    email: user.email ?? "",
    name: profileName || authName || undefined,
    avatarUrl: profile?.avatarUrl ?? user.image ?? null,
  };
}
