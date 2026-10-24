/**
 * Pure search, paging and URL helpers for the client "My shipments" list.
 * The list is small (one client's cases), so everything runs in the browser
 * and the state is mirrored into ?q=&page=&size= so a page can be shared.
 */
import { getTrackingLabel } from "@/lib/tracking/workflow";
import { resolveOriginCountry } from "./shipment-format";

export type SearchableShipment = {
  caseNumber: string;
  trackingStatus: string;
  trackingNote: string | null;
  supplierName: string | null;
  shipmentReference: string | null;
  billOfLadingNumber: string | null;
  airwayBillNumber: string | null;
  incoterm: string | null;
  invoiceCurrencyCode: string | null;
  supplierCountryCode: string | null;
  countryOfExportCode: string | null;
  countryOfOriginCode: string | null;
  productNames: string[];
};

export const SHIPMENT_PAGE_SIZES = [6, 12, 24, 48] as const;
export const DEFAULT_SHIPMENT_PAGE_SIZE = 12;

/** Lower-case, strip accents, collapse whitespace. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string): string {
  return value.replace(/[^a-z0-9]/g, "");
}

export type ShipmentHaystack = {
  text: string;
  /** Same text without punctuation or spaces, so "inv2024" finds "INV-2024". */
  compact: string;
};

export function buildShipmentHaystack(shipment: SearchableShipment): ShipmentHaystack {
  const origin = resolveOriginCountry(shipment);
  const parts: (string | null | undefined)[] = [
    shipment.caseNumber,
    shipment.shipmentReference,
    shipment.billOfLadingNumber,
    shipment.airwayBillNumber,
    shipment.supplierName,
    getTrackingLabel(shipment.trackingStatus),
    shipment.trackingStatus.replace(/_/g, " "),
    origin?.name,
    origin?.iso2,
    origin?.iso3,
    shipment.incoterm,
    shipment.invoiceCurrencyCode,
    shipment.trackingNote,
    ...shipment.productNames,
  ];
  const text = normalizeSearchText(parts.filter(Boolean).join(" "));
  return { text, compact: compact(text) };
}

/** Every word of the query must match somewhere in the shipment (AND). */
export function matchesQuery(haystack: ShipmentHaystack, query: string): boolean {
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => {
    if (haystack.text.includes(token)) return true;
    const c = compact(token);
    return c.length > 0 && haystack.compact.includes(c);
  });
}

export function filterShipments<T>(
  items: readonly T[],
  haystacks: readonly ShipmentHaystack[],
  query: string,
): T[] {
  if (normalizeSearchText(query) === "") return [...items];
  return items.filter((_, i) => matchesQuery(haystacks[i], query));
}

/* ------------------------------- URL state ------------------------------- */

export type ShipmentListState = {
  q: string;
  page: number;
  size: number;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Reads ?q=&page=&size= defensively (junk becomes defaults). */
export function parseShipmentListParams(params: {
  q?: string | string[];
  page?: string | string[];
  size?: string | string[];
}): ShipmentListState {
  const q = (first(params.q) ?? "").slice(0, 120);
  const pageRaw = Number.parseInt(first(params.page) ?? "", 10);
  const sizeRaw = Number.parseInt(first(params.size) ?? "", 10);
  return {
    q,
    page: Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1,
    size: (SHIPMENT_PAGE_SIZES as readonly number[]).includes(sizeRaw)
      ? sizeRaw
      : DEFAULT_SHIPMENT_PAGE_SIZE,
  };
}

/** Builds the URL for a state; defaults are left out to keep it short. */
export function buildShipmentListUrl(
  pathname: string,
  state: ShipmentListState,
): string {
  const params = new URLSearchParams();
  const q = state.q.trim();
  if (q) params.set("q", q);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.size !== DEFAULT_SHIPMENT_PAGE_SIZE) {
    params.set("size", String(state.size));
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export type ShipmentViewMode = "card" | "list";
export const SHIPMENT_VIEW_COOKIE = "my-shipments-view";

/** Card view is the default; only an explicit "list" switches it. */
export function parseShipmentView(raw: string | null | undefined): ShipmentViewMode {
  return raw === "list" ? "list" : "card";
}