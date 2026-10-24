import Link from "next/link";
import {
  ClientNotificationsList,
  type ClientNotificationItem,
} from "@/components/dashboard/client/ClientNotificationsList";
import { ClientShipmentCard } from "@/components/dashboard/client/ClientShipmentCard";
import type { ClientShipmentSummary } from "@/components/dashboard/client/ClientShipmentCard";
import {
  BentoCard,
  BentoCardHeader,
  KpiRingTile,
  PeriodPill,
} from "@/components/dashboard/bento/BentoCard";
import {
  GradientHeroCard,
  KpiProgressTile,
  StatList,
} from "@/components/dashboard/bento/DashboardCards";
import { BENTO_COLORS } from "@/components/dashboard/bento/charts";
import { SourceCountryMap } from "@/components/dashboard/map/SourceCountryMap";
import {
  DashButton,
  DashCard,
  DashCardHeader,
  DashLink,
  DashTable,
  DashTableAction,
  DashTableHead,
  DashTableHeaderRow,
  DashTbody,
  DashTd,
  DashTh,
  DashTr,
  StatusBadge,
} from "@/components/dashboard/ui";
import type { SourceCountrySummary } from "@/lib/dashboard-map-utils";
import { formatShare } from "@/lib/dashboard-map-utils";
import { getTrackingLabel } from "@/lib/tracking/workflow";

type ClientDashboardHomeProps = {
  displayName: string;
  shipments: ClientShipmentSummary[];
  notifications: ClientNotificationItem[];
  sourceSummary: SourceCountrySummary;
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
  sourceSummary,
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

  const total = shipments.length;
  const deliveredPct =
    total > 0 ? Math.round((delivered.length / total) * 100) : 0;
  const inProgressPct =
    total > 0 ? Math.round((active.length / total) * 100) : 0;

  const topSources = sourceSummary.countries.slice(0, 5);
  const sourceColors = [
    BENTO_COLORS.brand,
    BENTO_COLORS.indigo,
    BENTO_COLORS.sky,
    BENTO_COLORS.success,
    BENTO_COLORS.warning,
  ];

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#007bff]">
            Overview
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {displayName ? `Track order · ${displayName}` : "Track order"}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-slate-500">
            Follow your shipments from documents through customs to pickup.
          </p>
        </div>
        <DashButton href="/dashboard/my-shipments" variant="primary">
          All shipments
        </DashButton>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <SourceCountryMap
            summary={sourceSummary}
            title="Your shipments by source country"
            periodLabel="Linked to you"
          />
        </div>

        <div className="grid min-w-0 content-start gap-4 xl:col-span-4">
          <GradientHeroCard
            title="Your shipments"
            caption="Linked to your account"
            value={total.toLocaleString()}
            lines={
              ready.length > 0
                ? [
                    {
                      label: "Ready for pickup",
                      value: ready.length.toLocaleString(),
                    },
                  ]
                : undefined
            }
            href="/dashboard/my-shipments"
            actionLabel="View all"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <KpiRingTile
              label="Delivered"
              value={delivered.length.toLocaleString()}
              percent={deliveredPct}
              tone="green"
              hint="Completed shipments"
            />
            <KpiProgressTile
              label="In progress"
              badgeValue={active.length.toLocaleString()}
              percent={inProgressPct}
              caption={
                total > 0 ? `${inProgressPct}% of your shipments` : "No cases yet"
              }
              hint="Moving through workflow"
            />
          </div>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${
          topSources.length > 0 ? "xl:grid-cols-3" : "xl:grid-cols-2"
        }`}
      >
        {topSources.length > 0 ? (
          <BentoCard label="Top source countries">
            <BentoCardHeader
              title="Top source countries"
              action={<PeriodPill>Linked to you</PeriodPill>}
            />
            <StatList
              trendLabel="share of your shipments"
              rows={topSources.map((c, i) => ({
                key: c.iso2,
                label: c.name,
                value: `${c.count.toLocaleString()} ${
                  c.count === 1 ? "shipment" : "shipments"
                }`,
                caption: `${formatShare(c.share)} of your shipments`,
                percent: c.share,
                color: sourceColors[i % sourceColors.length]!,
              }))}
            />
          </BentoCard>
        ) : null}

        <BentoCard label="Shipment status">
          <BentoCardHeader title="Shipment status" />
          <StatList
            trendLabel="status"
            rows={[
              {
                key: "active",
                label: "In progress",
                value: active.length.toLocaleString(),
                percent: inProgressPct,
                color: BENTO_COLORS.brand,
              },
              {
                key: "ready",
                label: "Ready for pickup",
                value: ready.length.toLocaleString(),
                percent:
                  total > 0 ? Math.round((ready.length / total) * 100) : 0,
                color: BENTO_COLORS.warning,
              },
              {
                key: "delivered",
                label: "Delivered",
                value: delivered.length.toLocaleString(),
                percent: deliveredPct,
                color: BENTO_COLORS.success,
              },
            ]}
          />
        </BentoCard>

        {notifications.length > 0 ? (
          <BentoCard label="Recent updates" padded={false} className="overflow-hidden">
            <BentoCardHeader
              title="Recent updates"
              inset
              action={<PeriodPill>Latest</PeriodPill>}
            />
            <p className="border-b border-slate-100 px-5 pb-3 text-xs text-slate-500 sm:px-6">
              Same messages sent by SMS
            </p>
            <ClientNotificationsList items={notifications.slice(0, 5)} />
          </BentoCard>
        ) : null}
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
            <div className="grid gap-3 p-3 sm:p-4 md:hidden">
              {featured.map((shipment) => (
                <ClientShipmentCard key={shipment.id} shipment={shipment} />
              ))}
            </div>

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
    </div>
  );
}
