import { redirect } from "next/navigation";
import { NotificationsInbox } from "@/components/dashboard/client/NotificationsInbox";
import { PageHeader } from "@/components/dashboard/ui";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { canAccessPersonalShipments } from "@/lib/auth/roles";
import { getAuthUser } from "@/lib/auth/session";
import { listInboxNotifications } from "@/lib/notifications/client-inbox";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ id?: string | string[] }>;
};

export default async function NotificationsPage({ searchParams }: PageProps) {
  const user = await getAuthUser();
  if (!user?.id) redirect("/login?redirect=/dashboard/notifications");

  const session = await getSessionUserProfile();
  if (!canAccessPersonalShipments(session?.profile?.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const selectedId = Array.isArray(params.id) ? params.id[0] : params.id;

  const rows = await listInboxNotifications(user.id, { limit: 100 });
  const items = rows.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  }));

  const initialSelectedId =
    selectedId && items.some((n) => n.id === selectedId)
      ? selectedId
      : (items[0]?.id ?? null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Shipment updates from your broker — open a message to read it."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Notifications" },
        ]}
      />
      <NotificationsInbox
        initialItems={items}
        initialSelectedId={initialSelectedId}
      />
    </div>
  );
}
