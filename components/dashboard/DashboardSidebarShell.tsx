import {
  DashboardMobileNav,
  DashboardSidebar,
} from "@/components/dashboard/DashboardSidebar";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { canViewUserList } from "@/lib/auth/permissions";
import {
  canAccessPersonalShipments,
  isClientRole,
} from "@/lib/auth/roles";

export async function DashboardSidebarShell() {
  const session = await getSessionUserProfile();
  const role = session?.profile?.role;
  const isAdmin = role === "admin";
  const isAssessor = role === "assessor";
  const isClient = isClientRole(role);
  const canViewUsers = canViewUserList(role);
  const showNotifications = canAccessPersonalShipments(role);

  return (
    <>
      <DashboardSidebar
        isAdmin={isAdmin}
        isAssessor={isAssessor}
        isClient={isClient}
        canViewUsers={canViewUsers}
        showNotifications={showNotifications}
      />
      <div className="lg:hidden w-full shrink-0">
        <DashboardMobileNav
          isAdmin={isAdmin}
          isAssessor={isAssessor}
          isClient={isClient}
          canViewUsers={canViewUsers}
          showNotifications={showNotifications}
        />
      </div>
    </>
  );
}
