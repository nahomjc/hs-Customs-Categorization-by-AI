"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClientShipmentCard } from "@/components/dashboard/client/ClientShipmentCard";
import type { ClientShipmentSummary } from "@/components/dashboard/client/ClientShipmentCard";
import {
  DashCard,
  DashTable,
  DashTableAction,
  DashTableEmpty,
  DashTableHead,
  DashTableHeaderRow,
  DashTbody,
  DashTd,
  DashTh,
  DashTr,
  StatusBadge,
} from "@/components/dashboard/ui";
import { getTrackingLabel } from "@/lib/tracking/workflow";

type ViewMode = "card" | "list";

const STORAGE_KEY = "my-shipments-view";

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

export function MyShipmentsView({
  shipments,
}: {
  shipments: ClientShipmentSummary[];
}) {
  const [view, setView] = useState<ViewMode>("list");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "card" || saved === "list") setView(saved);
    } catch {
      // ignore
    }
  }, []);

  function changeView(next: ViewMode) {
    setView(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  if (shipments.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-[0_4px_24px_-12px_rgba(15,23,42,0.08)]">
        <p className="text-base font-semibold text-slate-900">
          No shipments yet
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          When your import broker creates a case and links your account, it will
          show here with live workflow progress.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {shipments.length} shipment{shipments.length === 1 ? "" : "s"}
        </p>
        <div
          className="inline-flex rounded-xl border border-gray-200 bg-white p-1"
          role="group"
          aria-label="View mode"
        >
          <button
            type="button"
            onClick={() => changeView("card")}
            aria-pressed={view === "card"}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === "card"
                ? "bg-[#007bff] text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <CardsIcon />
            Cards
          </button>
          <button
            type="button"
            onClick={() => changeView("list")}
            aria-pressed={view === "list"}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === "list"
                ? "bg-[#007bff] text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <ListIcon />
            List
          </button>
        </div>
      </div>

      {view === "card" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shipments.map((shipment) => (
            <ClientShipmentCard key={shipment.id} shipment={shipment} />
          ))}
        </div>
      ) : (
        <DashCard>
          <DashTable>
            <DashTableHead>
              <DashTableHeaderRow>
                <DashTh>Case #</DashTh>
                <DashTh>Reference</DashTh>
                <DashTh>Supplier</DashTh>
                <DashTh>Status</DashTh>
                <DashTh>Updated</DashTh>
                <DashTh align="right">Action</DashTh>
              </DashTableHeaderRow>
            </DashTableHead>
            <DashTbody>
              {shipments.length === 0 ? (
                <DashTableEmpty colSpan={6}>No shipments yet.</DashTableEmpty>
              ) : (
                shipments.map((shipment) => (
                  <DashTr key={shipment.id}>
                    <DashTd className="font-mono font-semibold text-gray-900">
                      <Link
                        href={`/dashboard/my-shipments/${shipment.id}`}
                        className="text-[#007bff] hover:underline"
                      >
                        {shipment.caseNumber}
                      </Link>
                    </DashTd>
                    <DashTd muted>
                      {shipment.shipmentReference ?? "—"}
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
                ))
              )}
            </DashTbody>
          </DashTable>
        </DashCard>
      )}
    </div>
  );
}

function CardsIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5h7v7H4V5zm9 0h7v7h-7V5zM4 14h7v7H4v-7zm9 0h7v7h-7v-7z"
      />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}
