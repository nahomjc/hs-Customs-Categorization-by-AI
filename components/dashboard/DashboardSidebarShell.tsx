import {
  DashboardMobileNav,
  DashboardSidebar,
} from "@/components/dashboard/DashboardSidebar";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { isClientRole } from "@/lib/auth/roles";

export async function DashboardSidebarShell() {
  const session = await getSessionUserProfile();
  const role = session?.profile?.role;
  const isAdmin = role === "admin";
  const isAssessor = role === "assessor";
  const isClient = isClientRole(role);

  return (
    <>
      <DashboardSidebar
        isAdmin={isAdmin}
        isAssessor={isAssessor}
        isClient={isClient}
      />
      <div className="lg:hidden w-full shrink-0">
        <DashboardMobileNav
          isAdmin={isAdmin}
          isAssessor={isAssessor}
          isClient={isClient}
        />
      </div>
    </>
  );
}
