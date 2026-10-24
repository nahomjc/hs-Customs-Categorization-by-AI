/**
 * Pure display helpers for the client "My shipments" cards and table.
 * Dates use a fixed locale and time zone so the server render and the browser
 * render always agree (no hydration mismatch).
 */
import { getCountryMeta, normalizeCountryCode } from "@/lib/country-codes";

export const SHIPMENT_TIME_ZONE = "Africa/Nairobi";

type DateLike = Date | string | null | undefined;

function toDate(value: DateLike): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const DATE_PARTS = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: SHIPMENT_TIME_ZONE,
});

/**
 * "24 Oct 2026", or null when there is no valid date. Month names come from
 * our own list (not Intl) so Node and every browser print the same text.
 */
export function formatShipmentDate(value: DateLike): string | null {
  const d = toDate(value);
  if (!d) return null;
  const parts = DATE_PARTS.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const day = Number(get("day"));
  const month = Number(get("month"));
  const year = Number(get("year"));
  if (!day || !month || !year) return null;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** Money as "$1,234.50" style via Intl, or the plain number plus code when the code is unknown. */
export function formatShipmentAmount(
  amount: string | number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (amount === null || amount === undefined || amount === "") return null;
  const n = typeof amount === "number" ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(n)) return null;
  const code = currency?.trim().toUpperCase();
  if (code && /^[A-Z]{3}$/.test(code)) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
      }).format(n);
    } catch {
      // unknown currency code: fall through
    }
  }
  const plain = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return code ? `${plain} ${code}` : plain;
}

export type OriginCountry = {
  iso2: string;
  iso3: string;
  name: string;
};

type CountryFields = {
  countryOfExportCode?: string | null;
  supplierCountryCode?: string | null;
  countryOfOriginCode?: string | null;
};

/**
 * Where the goods come from: country of export, else supplier country, else
 * country of origin (same order as the dashboard source-country map). Codes
 * we cannot recognise are skipped; null means no usable country on file.
 */
export function resolveOriginCountry(shipment: CountryFields): OriginCountry | null {
  for (const raw of [
    shipment.countryOfExportCode,
    shipment.supplierCountryCode,
    shipment.countryOfOriginCode,
  ]) {
    const iso2 = normalizeCountryCode(raw);
    if (!iso2) continue;
    const meta = getCountryMeta(iso2);
    if (meta) return { iso2: meta.iso2, iso3: meta.iso3, name: meta.name };
  }
  return null;
}

/** The transport document number to show: bill of lading, else airway bill. */
export function transportDocument(shipment: {
  billOfLadingNumber?: string | null;
  airwayBillNumber?: string | null;
}): { label: string; value: string } | null {
  const bl = shipment.billOfLadingNumber?.trim();
  if (bl) return { label: "Bill of lading", value: bl };
  const awb = shipment.airwayBillNumber?.trim();
  if (awb) return { label: "Airway bill", value: awb };
  return null;
}