import { normalizeDutyRate } from "./duty-format";

/** One display format ("30%" / "Free"); text that is not a plain rate is kept as written. */
function tidyDuty(raw: string): string {
  return normalizeDutyRate(raw).display || raw.trim();
}

/** Client-safe duty rate text from a stored tariff snapshot. */
export function formatDutyRateFromSnapshot(
  snapshot:
    | {
        customsDutyRate?: string | null;
        otherCharges?: unknown;
      }
    | null
    | undefined,
): string | null {
  if (!snapshot) return null;

  const other = snapshot.otherCharges as { dutyRateDisplay?: string } | null;
  if (other?.dutyRateDisplay) return tidyDuty(other.dutyRateDisplay);

  if (snapshot.customsDutyRate != null && snapshot.customsDutyRate !== "") {
    const rate = normalizeDutyRate(snapshot.customsDutyRate);
    if (rate.display) return rate.display;
  }

  return null;
}
