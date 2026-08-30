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
  if (other?.dutyRateDisplay) return other.dutyRateDisplay;

  if (snapshot.customsDutyRate != null && snapshot.customsDutyRate !== "") {
    const num = Number.parseFloat(snapshot.customsDutyRate);
    if (Number.isFinite(num)) {
      return num === 0 ? "0%" : `${snapshot.customsDutyRate}%`;
    }
  }

  return null;
}
