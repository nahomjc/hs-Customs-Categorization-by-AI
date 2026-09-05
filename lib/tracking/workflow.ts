import {
  TRACKING_STATUSES,
  TRACKING_STATUS_LABELS,
  type TrackingStatus,
} from "@/lib/tracking/constants";

/** Pipeline steps shown in the client workflow UI (excludes cancelled). */
export const TRACKING_PIPELINE = TRACKING_STATUSES.filter(
  (s) => s !== "cancelled",
) as TrackingStatus[];

export const TRACKING_STEP_DETAILS: Record<
  Exclude<TrackingStatus, "cancelled">,
  string
> = {
  received: "Your shipment file was opened",
  documents_in_progress: "Documents are being prepared",
  classification: "HS codes are being assigned",
  customs_clearance: "Customs clearance in progress",
  ready_for_pickup: "Ready for you to collect",
  delivered: "Shipment completed",
};

export function getTrackingStepIndex(status: string): number {
  if (status === "cancelled") return -1;
  return TRACKING_PIPELINE.indexOf(status as TrackingStatus);
}

export function getTrackingProgressPercent(status: string): number {
  if (status === "cancelled") return 0;
  if (status === "delivered") return 100;
  const index = getTrackingStepIndex(status);
  if (index < 0) return 0;
  return Math.round(((index + 1) / TRACKING_PIPELINE.length) * 100);
}

export function getTrackingLabel(status: string): string {
  if (status in TRACKING_STATUS_LABELS) {
    return TRACKING_STATUS_LABELS[status as TrackingStatus];
  }
  return status;
}
