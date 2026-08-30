import {
  DashboardMobileNav,
  DashboardSidebar,
} from "@/components/dashboard/DashboardSidebar";
import { getSessionUserProfile } from "@/lib/auth/require-admin";

export async function DashboardSidebarShell() {
  const session = await getSessionUserProfile();
  const isAdmin = session?.profile?.role === "admin";

  return (
    <>
      <DashboardSidebar isAdmin={isAdmin} />
      <div className="lg:hidden w-full shrink-0">
        <DashboardMobileNav isAdmin={isAdmin} />
      </div>
    </>
  );
}
