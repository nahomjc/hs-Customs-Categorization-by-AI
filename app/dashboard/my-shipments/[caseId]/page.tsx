import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { DashCard, PageHeader, StatusBadge } from "@/components/dashboard/ui";
import { ShipmentWorkflowStepper } from "@/components/dashboard/client/ShipmentWorkflowStepper";
import { db } from "@/db";
import { importCases, trackingStatusEvents } from "@/db/schema";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { isClientRole } from "@/lib/auth/roles";
import { getAuthUser } from "@/lib/auth/session";
import { getTenantId } from "@/lib/import-cases/queries";
import { getTrackingLabel } from "@/lib/tracking/workflow";
import type { TrackingStatus } from "@/lib/tracking/constants";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ caseId: string }>;
};

export default async function MyShipmentDetailPage({ params }: PageProps) {
  const { caseId } = await params;
  const user = await getAuthUser();
  if (!user?.id) redirect("/login?redirect=/dashboard/my-shipments");

  const session = await getSessionUserProfile();
  if (!isClientRole(session?.profile?.role)) {
    redirect(`/dashboard/import-cases/${caseId}`);
  }

  const tenantId = getTenantId();
  const [shipment] = await db
    .select()
    .from(importCases)
    .where(
      and(
        eq(importCases.id, caseId),
        eq(importCases.tenantId, tenantId),
        eq(importCases.clientUserId, user.id),
      ),
    )
    .limit(1);

  if (!shipment) notFound();

  const events = await db
    .select({
      status: trackingStatusEvents.status,
      note: trackingStatusEvents.note,
      createdAt: trackingStatusEvents.createdAt,
    })
    .from(trackingStatusEvents)
    .where(eq(trackingStatusEvents.importCaseId, caseId))
    .orderBy(asc(trackingStatusEvents.createdAt));

  const current = shipment.trackingStatus as TrackingStatus;

  return (
    <div className="space-y-6">
      <PageHeader
        title={shipment.caseNumber}
        description="Clearance workflow for this shipment"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My shipments", href: "/dashboard/my-shipments" },
          { label: shipment.caseNumber },
        ]}
        action={
          <StatusBadge
            label={getTrackingLabel(current)}
            status={current}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoTile
          label="Supplier"
          value={shipment.supplierName ?? "—"}
        />
        <InfoTile
          label="Shipment reference"
          value={shipment.shipmentReference ?? "—"}
        />
        <InfoTile
          label="Last update"
          value={(
            shipment.trackingUpdatedAt ?? shipment.updatedAt
          ).toLocaleString()}
        />
      </div>

      <DashCard className="overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Workflow
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">
            Track where your shipment is right now
          </p>
        </div>
        <div className="p-5 sm:p-6">
          <ShipmentWorkflowStepper
            status={current}
            note={shipment.trackingNote}
            variant="full"
            events={events}
          />
        </div>
      </DashCard>

      {events.length > 0 ? (
        <DashCard>
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Update history
            </h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {[...events].reverse().map((event) => (
              <li
                key={`${event.status}-${event.createdAt.toISOString()}`}
                className="flex items-start justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {getTrackingLabel(event.status)}
                  </p>
                  {event.note ? (
                    <p className="mt-0.5 text-xs text-slate-500">{event.note}</p>
                  ) : null}
                </div>
                <time className="shrink-0 text-[11px] text-slate-400">
                  {event.createdAt.toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        </DashCard>
      ) : null}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white px-5 py-4 shadow-[0_4px_20px_-12px_rgba(15,23,42,0.1)]">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-slate-900 break-words">
        {value}
      </p>
    </div>
  );
}
