import Link from "next/link";
import { ClientShipmentCard } from "@/components/dashboard/client/ClientShipmentCard";
import type { ClientShipmentSummary } from "@/components/dashboard/client/ClientShipmentCard";
import {
  DashCard,
  DashCardHeader,
  DashLink,
  DashTable,
  DashTableAction,
  DashTableEmpty,
  DashTableHead,
  DashTableHeaderRow,
  DashTbody,
  DashTd,
  DashTh,
  DashTr,
  PageHeader,
  StatusBadge,
} from "@/components/dashboard/ui";
import { getTrackingLabel } from "@/lib/tracking/workflow";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  importCaseId: string | null;
};

type ClientDashboardHomeProps = {
  displayName: string;
  shipments: ClientShipmentSummary[];
  notifications: NotificationItem[];
};

function formatUpdated(shipment: ClientShipmentSummary) {
  const raw = shipment.trackingUpdatedAt ?? shipment.updatedAt;
  const updated = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(updated.getTime())) return "—";
  return updated.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatNotificationDate(value: Date) {
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] sm:rounded-3xl sm:p-5">
      <p className="text-[11px] font-medium text-gray-500 sm:text-sm">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-gray-900 sm:text-3xl">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-gray-500 sm:mt-1 sm:text-xs">
        {hint}
      </p>
    </div>
  );
}

function EmptyShipments() {
  return (
    <div className="px-5 py-12 text-center sm:py-16">
      <p className="font-medium text-gray-800">No shipments yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
        When your broker opens an import case for you, it will appear here.
      </p>
    </div>
  );
}

export function ClientDashboardHome({
  displayName,
  shipments,
  notifications,
}: ClientDashboardHomeProps) {
  const active = shipments.filter(
    (s) => s.trackingStatus !== "delivered" && s.trackingStatus !== "cancelled",
  );
  const ready = shipments.filter(
    (s) => s.trackingStatus === "ready_for_pickup",
  );
  const delivered = shipments.filter((s) => s.trackingStatus === "delivered");

  const featured =
    active.length > 0 ? active.slice(0, 6) : shipments.slice(0, 6);

  return (
    <div className="w-full min-w-0 space-y-6 sm:space-y-8">
      <PageHeader
        title={`Welcome${displayName ? `, ${displayName}` : ""}`}
        description="Track every shipment from documents through customs to pickup."
        action={
          <Link
            href="/dashboard/my-shipments"
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#007bff] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0069d9] sm:w-auto"
          >
            All shipments
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatCard
          label="Total"
          value={shipments.length}
          hint="Linked to your account"
        />
        <StatCard
          label="In progress"
          value={active.length}
          hint="Moving through workflow"
        />
        <StatCard
          label="Ready"
          value={ready.length}
          hint="Ready for pickup"
        />
        <StatCard
          label="Delivered"
          value={delivered.length}
          hint="Completed shipments"
        />
      </div>

      {ready.length > 0 ? (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 sm:px-5 sm:py-3.5">
          <p className="text-sm font-semibold text-amber-900">
            {ready.length} shipment{ready.length === 1 ? "" : "s"} ready for
            pickup
          </p>
          <p className="mt-0.5 break-words text-xs text-amber-800/80">
            {ready.map((s) => s.caseNumber).join(" · ")}
          </p>
        </div>
      ) : null}

      <DashCard>
        <DashCardHeader
          title="Active shipments"
          action={
            shipments.length > 0 ? (
              <DashLink href="/dashboard/my-shipments">View all →</DashLink>
            ) : undefined
          }
        />
        <p className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-500 sm:px-5">
          Workflow progress for your latest cases
        </p>

        {featured.length === 0 ? (
          <EmptyShipments />
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="grid gap-3 p-3 sm:p-4 md:hidden">
              {featured.map((shipment) => (
                <ClientShipmentCard key={shipment.id} shipment={shipment} />
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block">
              <DashTable>
                <DashTableHead>
                  <DashTableHeaderRow>
                    <DashTh>Case #</DashTh>
                    <DashTh>Supplier</DashTh>
                    <DashTh>Status</DashTh>
                    <DashTh>Updated</DashTh>
                    <DashTh align="right">Action</DashTh>
                  </DashTableHeaderRow>
                </DashTableHead>
                <DashTbody>
                  {featured.map((shipment) => (
                    <DashTr key={shipment.id}>
                      <DashTd className="font-mono font-semibold text-gray-900">
                        <Link
                          href={`/dashboard/my-shipments/${shipment.id}`}
                          className="text-[#007bff] hover:underline"
                        >
                          {shipment.caseNumber}
                        </Link>
                        {shipment.shipmentReference ? (
                          <span className="mt-0.5 block text-xs font-normal text-gray-500">
                            Ref · {shipment.shipmentReference}
                          </span>
                        ) : null}
                      </DashTd>
                      <DashTd>{shipment.supplierName ?? "—"}</DashTd>
                      <DashTd>
                        <StatusBadge
                          label={getTrackingLabel(shipment.trackingStatus)}
                          status={shipment.trackingStatus}
                        />
                      </DashTd>
                      <DashTd muted nowrap>
                        {formatUpdated(shipment)}
                      </DashTd>
                      <DashTd align="right">
                        <DashTableAction
                          href={`/dashboard/my-shipments/${shipment.id}`}
                        >
                          View
                        </DashTableAction>
                      </DashTd>
                    </DashTr>
                  ))}
                </DashTbody>
              </DashTable>
            </div>
          </>
        )}
      </DashCard>

      {notifications.length > 0 ? (
        <DashCard>
          <DashCardHeader title="Recent updates" />
          <p className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-500 sm:px-5">
            Status changes sent to your dashboard
          </p>
          <ul className="divide-y divide-gray-50">
            {notifications.map((n) => {
              const inner = (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900">
                        {n.title}
                      </p>
                      <time className="shrink-0 text-[11px] text-gray-400">
                        {formatNotificationDate(n.createdAt)}
                      </time>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                      {n.body}
                    </p>
                  </div>
                </>
              );

              return (
                <li key={n.id}>
                  {n.importCaseId ? (
                    <Link
                      href={`/dashboard/my-shipments/${n.importCaseId}`}
                      className="flex px-4 py-3.5 transition-colors hover:bg-gray-50/80 sm:px-5 sm:py-4"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex px-4 py-3.5 sm:px-5 sm:py-4">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </DashCard>
      ) : null}
    </div>
  );
}
