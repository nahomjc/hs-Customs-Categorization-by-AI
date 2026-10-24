import {
  TRACKING_STATUS_DEFAULT_NOTES,
  TRACKING_STATUS_LABELS,
  type TrackingStatus,
} from "@/lib/tracking/constants";

/** Client-facing message (dashboard, Telegram); matches staff note or stage default. */
export function trackingClientMessage(
  status: TrackingStatus,
  note?: string | null,
): string {
  const trimmed = note?.trim();
  if (trimmed) return trimmed;
  return TRACKING_STATUS_DEFAULT_NOTES[status];
}

export function trackingNotificationTitle(
  caseNumber: string,
  status: TrackingStatus,
): string {
  return `${caseNumber}: ${TRACKING_STATUS_LABELS[status]}`;
}

export function trackingSmsText(
  caseNumber: string,
  status: TrackingStatus,
  note?: string | null,
): string {
  const label = TRACKING_STATUS_LABELS[status];
  const message = trackingClientMessage(status, note);
  const line = `${caseNumber}: ${label} — ${message}`;
  return line.slice(0, 160);
}
