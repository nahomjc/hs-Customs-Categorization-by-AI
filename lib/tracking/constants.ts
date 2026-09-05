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

export const TRACKING_SOURCES = ["web", "telegram", "sms", "system"] as const;
export type TrackingSource = (typeof TRACKING_SOURCES)[number];

export function isTrackingStatus(value: string): value is TrackingStatus {
  return (TRACKING_STATUSES as readonly string[]).includes(value);
}
