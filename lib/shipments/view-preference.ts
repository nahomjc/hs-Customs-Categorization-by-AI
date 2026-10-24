import { SHIPMENT_VIEW_COOKIE, type ShipmentViewMode } from "./shipment-search";

/** Remembers the card/list choice for a year; the server reads it on the next visit. */
export function saveShipmentView(mode: ShipmentViewMode): void {
  document.cookie = `${SHIPMENT_VIEW_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
}