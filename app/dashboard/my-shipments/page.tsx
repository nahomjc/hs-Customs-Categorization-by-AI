import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MyShipmentsView } from "@/components/dashboard/client/MyShipmentsView";
import { PageHeader } from "@/components/dashboard/ui";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { canAccessPersonalShipments } from "@/lib/auth/roles";
import { getAuthUser } from "@/lib/auth/session";
import { listClientShipments } from "@/lib/dashboard/client-shipments";
import {
  SHIPMENT_VIEW_COOKIE,
  parseShipmentListParams,
  parseShipmentView,
} from "@/lib/shipments/shipment-search";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    q?: string | string[];
    page?: string | string[];
    size?: string | string[];
  }>;
};

export default async function MyShipmentsPage({ searchParams }: PageProps) {
  const user = await getAuthUser();
  if (!user?.id) redirect("/login?redirect=/dashboard/my-shipments");

  const session = await getSessionUserProfile();
  const role = session?.profile?.role;
  if (!canAccessPersonalShipments(role)) {
    redirect("/dashboard/import-cases");
  }

  const shipments = await listClientShipments(user.id);
  const list = parseShipmentListParams(await searchParams);
  // Card view is the default; the choice is remembered in a cookie so the
  // server renders the right view with no flash.
  const view = parseShipmentView(
    (await cookies()).get(SHIPMENT_VIEW_COOKIE)?.value,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="My shipments"
        description="Follow each case through the clearance workflow."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My shipments" },
        ]}
      />

      <MyShipmentsView
        shipments={shipments}
        initialQuery={list.q}
        initialPage={list.page}
        initialPageSize={list.size}
        initialView={view}
      />
    </div>
  );
}
