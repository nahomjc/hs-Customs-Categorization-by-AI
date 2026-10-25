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

/** Max chars for outbound tracking SMS (multi-segment; was single-SMS 160). */
export const TRACKING_SMS_MAX_CHARS = 480;

export function trackingSmsText(
  caseNumber: string,
  status: TrackingStatus,
  note?: string | null,
): string {
  const label = TRACKING_STATUS_LABELS[status];
  const message = trackingClientMessage(status, note);
  const prefix = `${caseNumber}: ${label} — `;
  const budget = Math.max(0, TRACKING_SMS_MAX_CHARS - prefix.length);
  return `${prefix}${message.slice(0, budget)}`;
}
