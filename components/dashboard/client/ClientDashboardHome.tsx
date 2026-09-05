import Link from "next/link";
import { PageHeader } from "@/components/dashboard/ui";
import { ClientShipmentCard } from "@/components/dashboard/client/ClientShipmentCard";
import type { ClientShipmentSummary } from "@/components/dashboard/client/ClientShipmentCard";
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

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint: string;
  accent: "blue" | "emerald" | "amber" | "slate";
}) {
  const accents = {
    blue: "from-sky-50 to-white border-sky-100 text-[#007bff]",
    emerald: "from-emerald-50 to-white border-emerald-100 text-emerald-700",
    amber: "from-amber-50 to-white border-amber-100 text-amber-700",
    slate: "from-slate-50 to-white border-slate-200 text-slate-700",
  };

  return (
    <div
      className={`rounded-3xl border bg-gradient-to-br p-5 shadow-[0_4px_20px_-12px_rgba(15,23,42,0.1)] ${accents[accent]}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
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
  const featured = shipments.slice(0, 4);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome${displayName ? `, ${displayName}` : ""}`}
        description="Track every shipment from documents through customs to pickup."
        action={
          <Link
            href="/dashboard/my-shipments"
            className="inline-flex items-center justify-center rounded-xl bg-[#007bff] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0069d9] shadow-sm"
          >
            All shipments
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total"
          value={shipments.length}
          hint="Linked to your account"
          accent="slate"
        />
        <StatCard
          label="In progress"
          value={active.length}
          hint="Moving through workflow"
          accent="blue"
        />
        <StatCard
          label="Ready"
          value={ready.length}
          hint="Ready for pickup"
          accent="amber"
        />
        <StatCard
          label="Delivered"
          value={delivered.length}
          hint="Completed shipments"
          accent="emerald"
        />
      </div>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Active shipments
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Workflow progress for your latest cases
            </p>
          </div>
          {shipments.length > 4 ? (
            <Link
              href="/dashboard/my-shipments"
              className="text-sm font-semibold text-[#007bff] hover:underline"
            >
              View all
            </Link>
          ) : null}
        </div>

        {featured.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No shipments yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              When your broker opens an import case for you, it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
            {featured.map((shipment) => (
              <ClientShipmentCard key={shipment.id} shipment={shipment} />
            ))}
          </div>
        )}
      </section>

      {notifications.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Recent updates
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Status changes sent to your dashboard
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200/80 bg-white shadow-[0_4px_24px_-12px_rgba(15,23,42,0.1)] overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <li key={n.id}>
                  {n.importCaseId ? (
                    <Link
                      href={`/dashboard/my-shipments/${n.importCaseId}`}
                      className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                          {n.body}
                        </p>
                      </div>
                      <time className="shrink-0 text-[11px] text-slate-400">
                        {n.createdAt.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </Link>
                  ) : (
                    <div className="flex items-start justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {n.body}
                        </p>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {ready.length > 0 ? (
        <section className="rounded-3xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-white px-5 py-4 sm:px-6">
          <p className="text-sm font-semibold text-amber-900">
            {ready.length} shipment{ready.length === 1 ? "" : "s"} ready for
            pickup
          </p>
          <p className="mt-1 text-xs text-amber-800/80">
            {ready
              .map((s) => `${s.caseNumber} · ${getTrackingLabel(s.trackingStatus)}`)
              .join(" · ")}
          </p>
        </section>
      ) : null}
    </div>
  );
}
