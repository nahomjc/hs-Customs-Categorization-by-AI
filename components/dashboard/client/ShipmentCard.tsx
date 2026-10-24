import Link from "next/link";
import { memo } from "react";
import { CountryFlag } from "@/components/dashboard/client/CountryFlag";
import type { ClientShipmentSummary } from "@/components/dashboard/client/ClientShipmentCard";
import { ShipmentRouteMap } from "@/components/dashboard/client/ShipmentRouteMap";
import { ShipmentWorkflowStepper } from "@/components/dashboard/client/ShipmentWorkflowStepper";
import { StatusBadge } from "@/components/dashboard/ui";
import { DESTINATION_ISO2, getCountryMeta } from "@/lib/country-codes";
import {
  formatShipmentAmount,
  formatShipmentDate,
  resolveOriginCountry,
  transportDocument,
} from "@/lib/shipments/shipment-format";
import { getTrackingLabel } from "@/lib/tracking/workflow";

type Fact = { label: string; value: string };

/** Up to four real facts: supplier first, then whichever of these the case has. */
function buildFacts(shipment: ClientShipmentSummary): Fact[] {
  const facts: Fact[] = [
    { label: "Supplier", value: shipment.supplierName?.trim() || "\u2014" },
  ];
  const optional: (Fact | null)[] = [
    (() => {
      const v = formatShipmentAmount(
        shipment.invoiceTotalAmount,
        shipment.invoiceCurrencyCode,
      );
      return v ? { label: "Invoice total", value: v } : null;
    })(),
    shipment.productCount > 0
      ? { label: "Products", value: shipment.productCount.toLocaleString("en-US") }
      : null,
    (() => {
      const doc = transportDocument(shipment);
      return doc ? { label: doc.label, value: doc.value } : null;
    })(),
    shipment.incoterm?.trim()
      ? { label: "Incoterm", value: shipment.incoterm.trim() }
      : null,
  ];
  for (const f of optional) {
    if (f && facts.length < 4) facts.push(f);
  }
  return facts;
}

/**
 * Client shipment card: reference + status, a route map with flags for the
 * origin and Ethiopia, workflow progress, key facts and dates. Everything shown
 * comes from the case; missing values are left out or shown as a dash.
 * Needs <ShipmentMapDefs /> on the page for the map.
 */
export const ShipmentCard = memo(function ShipmentCard({
  shipment,
}: {
  shipment: ClientShipmentSummary;
}) {
  const origin = resolveOriginCountry(shipment);
  const destination = getCountryMeta(DESTINATION_ISO2);
  const facts = buildFacts(shipment);
  const opened = formatShipmentDate(shipment.createdAt);
  const updated = formatShipmentDate(
    shipment.trackingUpdatedAt ?? shipment.updatedAt,
  );
  const statusLabel = getTrackingLabel(shipment.trackingStatus);

  return (
    <Link
      href={`/dashboard/my-shipments/${shipment.id}`}
      aria-label={`${shipment.caseNumber}, ${statusLabel}. Open workflow.`}
      className="group flex h-full min-w-0 flex-col rounded-2xl border border-slate-200/70 bg-white p-4 transition-colors hover:border-[#007bff]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007bff]/40 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-bold text-slate-900 transition-colors group-hover:text-[#007bff]">
            {shipment.caseNumber}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {shipment.shipmentReference
              ? `Ref \u00b7 ${shipment.shipmentReference}`
              : "No shipment reference yet"}
          </p>
        </div>
        <StatusBadge label={statusLabel} status={shipment.trackingStatus} />
      </div>

      <div className="mt-4">
        <ShipmentRouteMap
          originIso2={origin?.iso2 ?? null}
          originName={origin?.name ?? null}
        />
        <div className="mt-2.5 flex items-center gap-2 text-xs">
          <span className="flex min-w-0 items-center gap-1.5">
            <CountryFlag iso2={origin?.iso2} />
            <span
              className={`truncate font-semibold ${
                origin ? "text-slate-800" : "text-slate-400"
              }`}
            >
              {origin?.name ?? "Origin not on file"}
            </span>
          </span>
          <svg
            className="h-3.5 w-3.5 shrink-0 text-slate-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-5-5 5 5-5 5" />
          </svg>
          <span className="flex min-w-0 items-center gap-1.5">
            <CountryFlag iso2={destination?.iso2} />
            <span className="truncate font-semibold text-slate-800">
              {destination?.name ?? "Ethiopia"}
            </span>
          </span>
        </div>
      </div>

      <div className="mt-4">
        <ShipmentWorkflowStepper status={shipment.trackingStatus} variant="compact" />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4">
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {fact.label}
            </dt>
            <dd className="mt-0.5 truncate text-sm font-medium text-slate-800">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      {shipment.trackingNote ? (
        <p className="mt-3 line-clamp-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {shipment.trackingNote}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-slate-500">
        <span className="min-w-0 truncate">
          {opened ? `Opened ${opened}` : "Opened date unknown"}
          {updated ? ` \u00b7 Updated ${updated}` : ""}
        </span>
        <span className="shrink-0 font-semibold text-[#007bff]">View workflow</span>
      </div>
    </Link>
  );
});