import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/ui";
import { ShipmentWorkflowStepper } from "@/components/dashboard/client/ShipmentWorkflowStepper";
import { getTrackingLabel } from "@/lib/tracking/workflow";

export type ClientShipmentSummary = {
  id: string;
  caseNumber: string;
  trackingStatus: string;
  trackingNote: string | null;
  trackingUpdatedAt: Date | null;
  supplierName: string | null;
  shipmentReference: string | null;
  updatedAt: Date;
};

export function ClientShipmentCard({
  shipment,
}: {
  shipment: ClientShipmentSummary;
}) {
  const updated = shipment.trackingUpdatedAt ?? shipment.updatedAt;

  return (
    <Link
      href={`/dashboard/my-shipments/${shipment.id}`}
      className="group block rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_24px_-12px_rgba(15,23,42,0.12)] transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_12px_32px_-12px_rgba(0,123,255,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007bff]/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold text-slate-900 group-hover:text-[#007bff] transition-colors">
            {shipment.caseNumber}
          </p>
          {shipment.shipmentReference ? (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              Ref · {shipment.shipmentReference}
            </p>
          ) : null}
        </div>
        <StatusBadge
          label={getTrackingLabel(shipment.trackingStatus)}
          status={shipment.trackingStatus}
        />
      </div>

      <div className="mt-4">
        <ShipmentWorkflowStepper
          status={shipment.trackingStatus}
          variant="compact"
        />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Supplier
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-700">
            {shipment.supplierName ?? "—"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Updated
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {updated.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {shipment.trackingNote ? (
        <p className="mt-3 line-clamp-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {shipment.trackingNote}
        </p>
      ) : null}

      <p className="mt-3 text-xs font-semibold text-[#007bff] opacity-0 transition-opacity group-hover:opacity-100">
        View workflow →
      </p>
    </Link>
  );
}
