"use client";

import { UserMenu, type UserMenuUser } from "@/components/auth/UserMenu";

type DashboardNavProps = {
  user: UserMenuUser;
};

export function DashboardNav({ user }: DashboardNavProps) {
  return <UserMenu user={user} />;
}
