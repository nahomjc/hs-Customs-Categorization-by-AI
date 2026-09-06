import { redirect } from "next/navigation";
import { MyShipmentsView } from "@/components/dashboard/client/MyShipmentsView";
import { PageHeader } from "@/components/dashboard/ui";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { isClientRole } from "@/lib/auth/roles";
import { getAuthUser } from "@/lib/auth/session";
import { listClientShipments } from "@/lib/dashboard/client-shipments";

export const dynamic = "force-dynamic";

export default async function MyShipmentsPage() {
  const user = await getAuthUser();
  if (!user?.id) redirect("/login?redirect=/dashboard/my-shipments");

  const session = await getSessionUserProfile();
  if (!isClientRole(session?.profile?.role)) {
    redirect("/dashboard/import-cases");
  }

  const shipments = await listClientShipments(user.id);

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

      <MyShipmentsView shipments={shipments} />
    </div>
  );
}
