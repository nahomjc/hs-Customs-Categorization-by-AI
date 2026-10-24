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
import { summarizeSourceCountries } from "@/lib/dashboard-map-utils";
import { fetchClientCasesBySourceCountry } from "@/lib/import-cases-analytics";
import { getTenantId } from "@/lib/import-cases/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSessionUserProfile();

  if (isClientRole(session?.profile?.role)) {
    const user = await getAuthUser();
    if (!user?.id) redirect("/login?redirect=/dashboard");

    const tenantId = getTenantId();
    const [shipments, notifications, sourceRows] = await Promise.all([
      listClientShipments(user.id),
      listClientNotifications(user.id),
      fetchClientCasesBySourceCountry(tenantId, user.id),
    ]);
    const sourceSummary = summarizeSourceCountries(sourceRows ?? []);

    const displayName =
      session?.profile?.fullName?.split(" ")[0] ??
      user.name?.split(" ")[0] ??
      "";

    return (
      <ClientDashboardHome
        displayName={displayName}
        shipments={shipments}
        notifications={notifications}
        sourceSummary={sourceSummary}
      />
    );
  }

  return <DashboardOverview />;
}
