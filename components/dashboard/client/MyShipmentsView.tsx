"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CountryFlag } from "@/components/dashboard/client/CountryFlag";
import type { ClientShipmentSummary } from "@/components/dashboard/client/ClientShipmentCard";
import { ShipmentCard } from "@/components/dashboard/client/ShipmentCard";
import { ShipmentMapDefs } from "@/components/dashboard/client/ShipmentRouteMap";
import { Pagination } from "@/components/dashboard/Pagination";
import {
  DashCard,
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
import { getPageBounds } from "@/lib/import-cases/pagination";
import {
  formatShipmentDate,
  resolveOriginCountry,
} from "@/lib/shipments/shipment-format";
import {
  DEFAULT_SHIPMENT_PAGE_SIZE,
  SHIPMENT_PAGE_SIZES,
  SHIPMENT_VIEW_COOKIE,
  buildShipmentHaystack,
  buildShipmentListUrl,
  filterShipments,
  type ShipmentViewMode,
} from "@/lib/shipments/shipment-search";
import { getTrackingLabel } from "@/lib/tracking/workflow";

type Props = {
  shipments: ClientShipmentSummary[];
  /** Initial state read from ?q=&page=&size= and the view cookie on the server. */
  initialQuery?: string;
  initialPage?: number;
  initialPageSize?: number;
  initialView?: ShipmentViewMode;
};

function ShipmentsTable({ shipments }: { shipments: ClientShipmentSummary[] }) {
  return (
    <DashTable>
      <DashTableHead>
        <DashTableHeaderRow>
          <DashTh>Case #</DashTh>
          <DashTh>Origin</DashTh>
          <DashTh>Reference</DashTh>
          <DashTh>Supplier</DashTh>
          <DashTh>Status</DashTh>
          <DashTh>Updated</DashTh>
          <DashTh align="right">Action</DashTh>
        </DashTableHeaderRow>
      </DashTableHead>
      <DashTbody>
        {shipments.map((shipment) => {
          const origin = resolveOriginCountry(shipment);
          return (
            <DashTr key={shipment.id}>
              <DashTd className="font-mono font-semibold text-gray-900">
                <Link
                  href={`/dashboard/my-shipments/${shipment.id}`}
                  className="text-[#007bff] hover:underline"
                >
                  {shipment.caseNumber}
                </Link>
              </DashTd>
              <DashTd>
                {origin ? (
                  <span className="inline-flex items-center gap-2">
                    <CountryFlag iso2={origin.iso2} />
                    <span>{origin.name}</span>
                  </span>
                ) : (
                  <span className="text-slate-400">{"\u2014"}</span>
                )}
              </DashTd>
              <DashTd muted>{shipment.shipmentReference ?? "\u2014"}</DashTd>
              <DashTd>{shipment.supplierName ?? "\u2014"}</DashTd>
              <DashTd>
                <StatusBadge
                  label={getTrackingLabel(shipment.trackingStatus)}
                  status={shipment.trackingStatus}
                />
              </DashTd>
              <DashTd muted nowrap>
                {formatShipmentDate(
                  shipment.trackingUpdatedAt ?? shipment.updatedAt,
                ) ?? "\u2014"}
              </DashTd>
              <DashTd align="right">
                <DashTableAction href={`/dashboard/my-shipments/${shipment.id}`}>
                  View
                </DashTableAction>
              </DashTd>
            </DashTr>
          );
        })}
      </DashTbody>
    </DashTable>
  );
}

export function MyShipmentsView({
  shipments,
  initialQuery = "",
  initialPage = 1,
  initialPageSize = DEFAULT_SHIPMENT_PAGE_SIZE,
  initialView = "card",
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [requestedPage, setRequestedPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [view, setView] = useState<ShipmentViewMode>(initialView);
  const listTop = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  const haystacks = useMemo(
    () => shipments.map(buildShipmentHaystack),
    [shipments],
  );
  const filtered = useMemo(
    () => filterShipments(shipments, haystacks, query),
    [shipments, haystacks, query],
  );
  const bounds = getPageBounds(filtered.length, requestedPage, pageSize);
  const visible = filtered.slice(bounds.start, bounds.end);
  const searching = query.trim() !== "";

  // Keep ?q=&page=&size= in the address bar without a server round trip.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const url = buildShipmentListUrl(window.location.pathname, {
      q: query,
      page: bounds.page,
      size: pageSize,
    });
    window.history.replaceState(window.history.state, "", url);
  }, [query, bounds.page, pageSize]);

  function changeQuery(next: string) {
    setQuery(next);
    setRequestedPage(1);
  }

  function changePage(next: number) {
    setRequestedPage(next);
    listTop.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function changePageSize(next: number) {
    setPageSize(next);
    setRequestedPage(1);
  }

  function changeView(next: ShipmentViewMode) {
    setView(next);
    document.cookie = `${SHIPMENT_VIEW_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  if (shipments.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center sm:px-6 sm:py-16">
        <p className="text-base font-semibold text-slate-900">No shipments yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          When your import broker creates a case and links your account, it will
          show here with live workflow progress.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <ShipmentMapDefs />

      <div
        ref={listTop}
        className="flex scroll-mt-24 flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 sm:p-4"
      >
        <div className="relative min-w-0 flex-1 basis-64">
          <label htmlFor="shipment-search" className="sr-only">
            Search shipments
          </label>
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"
            />
          </svg>
          <input
            id="shipment-search"
            type="search"
            value={query}
            onChange={(e) => changeQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                changeQuery("");
              }
            }}
            placeholder="Search case, reference, supplier, country, product, status"
            autoComplete="off"
            spellCheck={false}
            className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-10 text-sm text-gray-900 placeholder:text-slate-400 focus:border-[#007bff] focus:outline-none focus:ring-[3px] focus:ring-[#007bff]/12 [&::-webkit-search-cancel-button]:hidden"
          />
          {searching ? (
            <button
              type="button"
              onClick={() => changeQuery("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007bff]/40"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          ) : null}
        </div>

        <p className="text-sm text-slate-500" role="status" aria-live="polite">
          {searching
            ? `${filtered.length} of ${shipments.length} shipment${shipments.length === 1 ? "" : "s"}`
            : `${shipments.length} shipment${shipments.length === 1 ? "" : "s"}`}
        </p>

        {/* View toggle: desktop only. Mobile always shows cards. */}
        <div
          className="hidden rounded-xl border border-gray-200 bg-white p-1 md:inline-flex"
          role="group"
          aria-label="View mode"
        >
          {(
            [
              ["card", "Cards", <CardsIcon key="c" />],
              ["list", "List", <ListIcon key="l" />],
            ] as const
          ).map(([mode, label, icon]) => (
            <button
              key={mode}
              type="button"
              onClick={() => changeView(mode)}
              aria-pressed={view === mode}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007bff]/40 ${
                view === mode
                  ? "bg-[#007bff] text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center sm:px-6">
          <p className="text-base font-semibold text-slate-900">
            No shipments match your search
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Nothing matches {"\u201c"}
            <span className="break-all font-medium text-slate-700">{query.trim()}</span>
            {"\u201d"}. Try a case number, supplier, country, product or status.
          </p>
          <button
            type="button"
            onClick={() => changeQuery("")}
            className="mt-4 inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#007bff]/20"
          >
            Clear search
          </button>
        </div>
      ) : (
        <>
          {/* Cards (always on mobile; on desktop when the card view is chosen). */}
          <div
            className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${
              view === "list" ? "md:hidden" : ""
            }`}
          >
            {visible.map((shipment) => (
              <ShipmentCard key={shipment.id} shipment={shipment} />
            ))}
          </div>

          {view === "list" ? (
            <div className="hidden md:block">
              <DashCard>
                <ShipmentsTable shipments={visible} />
              </DashCard>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white [&>div]:border-t-0">
            <Pagination
              bounds={bounds}
              onPageChange={changePage}
              onPageSizeChange={changePageSize}
              itemLabel="shipments"
              pageSizeOptions={SHIPMENT_PAGE_SIZES}
            />
          </div>
        </>
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
      aria-hidden="true"
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
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}