import { redirect } from "next/navigation";
import { ClientDashboardHome } from "@/components/dashboard/client/ClientDashboardHome";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { isClientRole } from "@/lib/auth/roles";
import { getAuthUser } from "@/lib/auth/session";
import {
  listClientNotifications,
  listClientShipments,
} from "@/lib/dashboard/client-shipments";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSessionUserProfile();

  if (isClientRole(session?.profile?.role)) {
    const user = await getAuthUser();
    if (!user?.id) redirect("/login?redirect=/dashboard");

    const [shipments, notifications] = await Promise.all([
      listClientShipments(user.id),
      listClientNotifications(user.id),
    ]);

    const displayName =
      session?.profile?.fullName?.split(" ")[0] ??
      user.name?.split(" ")[0] ??
      "";

    return (
      <ClientDashboardHome
        displayName={displayName}
        shipments={shipments}
        notifications={notifications}
      />
    );
  }

  return <DashboardOverview />;
}
