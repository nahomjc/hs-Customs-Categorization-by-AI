import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/ui";
import { ClientShipmentCard } from "@/components/dashboard/client/ClientShipmentCard";
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
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "My shipments" }]}
      />

      {shipments.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-[0_4px_24px_-12px_rgba(15,23,42,0.08)]">
          <p className="text-base font-semibold text-slate-900">
            No shipments yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            When your import broker creates a case and links your account, it
            will show here with live workflow progress.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shipments.map((shipment) => (
            <ClientShipmentCard key={shipment.id} shipment={shipment} />
          ))}
        </div>
      )}
    </div>
  );
}
