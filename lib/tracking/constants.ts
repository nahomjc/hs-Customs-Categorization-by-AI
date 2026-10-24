export const TRACKING_STATUSES = [
  "received",
  "documents_in_progress",
  "classification",
  "customs_clearance",
  "ready_for_pickup",
  "delivered",
  "cancelled",
] as const;

export type TrackingStatus = (typeof TRACKING_STATUSES)[number];

export const TRACKING_STATUS_LABELS: Record<TrackingStatus, string> = {
  received: "Order received",
  documents_in_progress: "Documents in progress",
  classification: "Classification",
  customs_clearance: "Customs clearance",
  ready_for_pickup: "Ready for pickup",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Default client-facing note when staff picks a tracking stage (editable before send). */
export const TRACKING_STATUS_DEFAULT_NOTES: Record<TrackingStatus, string> = {
  received:
    "We have received your shipment and opened your import case. We will keep you updated as work progresses.",
  documents_in_progress:
    "We are reviewing your invoices, packing lists, and other documents for this shipment.",
  classification:
    "We are classifying your products and confirming HS codes for customs.",
  customs_clearance:
    "Your shipment is in customs clearance. We will notify you when there is an update.",
  ready_for_pickup:
    "Your shipment has cleared customs and is ready for pickup or final delivery.",
  delivered:
    "Your shipment has been delivered. Thank you for choosing Impact Logistics.",
  cancelled:
    "This shipment has been cancelled. Please contact us if you need assistance.",
};

export const TRACKING_SOURCES = ["web", "telegram", "sms", "system"] as const;
export type TrackingSource = (typeof TRACKING_SOURCES)[number];

export function isTrackingStatus(value: string): value is TrackingStatus {
  return (TRACKING_STATUSES as readonly string[]).includes(value);
}
