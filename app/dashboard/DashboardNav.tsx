"use client";

import { UserMenu, type UserMenuUser } from "@/components/auth/UserMenu";

type DashboardNavProps = {
  user: UserMenuUser;
  isClient?: boolean;
  showMyShipmentsLink?: boolean;
};

export function DashboardNav({
  user,
  isClient = false,
  showMyShipmentsLink = false,
}: DashboardNavProps) {
  return (
    <UserMenu
      user={user}
      isClient={isClient}
      showMyShipmentsLink={showMyShipmentsLink}
    />
  );
}
