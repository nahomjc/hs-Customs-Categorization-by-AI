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

/**
 * Ethiopian SMS providers (SMSHub / SMS Ethiopia) allow ~160 GSM-7 chars, but
 * only 70 when the body needs Unicode (Amharic, em dashes, curly quotes, etc.).
 */
export const TRACKING_SMS_MAX_GSM = 160;
export const TRACKING_SMS_MAX_UNICODE = 70;

/** @deprecated use TRACKING_SMS_MAX_UNICODE / trackingSmsLimitForText */
export const TRACKING_SMS_MAX_CHARS = TRACKING_SMS_MAX_UNICODE;

/** True when the text cannot be sent as a single GSM-7 SMS segment. */
export function smsNeedsUnicode(text: string): boolean {
  // GSM 03.38 basic set + common extension escapes (\n \r etc. already in range).
  // Anything outside Latin-1-ish GSM basic fails → Unicode / UCS-2 (70 char cap).
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x7f) {
      // Allow a few GSM extension / Latin-1 punctuation often used in English notes.
      if (ch === "€" || ch === "[" || ch === "]" || ch === "{" || ch === "}" || ch === "|" || ch === "^" || ch === "~" || ch === "\\") {
        continue;
      }
      // Non-ASCII → treat as Unicode (Amharic, curly dashes, smart quotes, …).
      return true;
    }
  }
  return false;
}

export function trackingSmsLimitForText(text: string): number {
  return smsNeedsUnicode(text) ? TRACKING_SMS_MAX_UNICODE : TRACKING_SMS_MAX_GSM;
}

function clipSms(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 1) return text.slice(0, max);
  return `${text.slice(0, max - 1)}…`;
}

/**
 * Build an SMS body that fits the provider limit for its encoding.
 * Unicode/Amharic: short template so more of the note fits in 70 chars.
 */
export function trackingSmsText(
  caseNumber: string,
  status: TrackingStatus,
  note?: string | null,
): string {
  const label = TRACKING_STATUS_LABELS[status];
  const message = trackingClientMessage(status, note);

  // Prefer a compact Unicode-safe form when the note (or label) needs it.
  const fullLatin = `${caseNumber}: ${label} - ${message}`;
  if (!smsNeedsUnicode(fullLatin) && !smsNeedsUnicode(message)) {
    return clipSms(fullLatin, TRACKING_SMS_MAX_GSM);
  }

  // Unicode path: keep case # + note only (status is already on the dashboard).
  const compact = `${caseNumber}: ${message}`;
  return clipSms(compact, TRACKING_SMS_MAX_UNICODE);
}
