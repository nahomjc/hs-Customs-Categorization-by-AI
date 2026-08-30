import { findInCacheSync, findReferenceForHsCode } from "@/lib/hsReferenceCache";
import { loadHsReferenceCache } from "@/lib/hsReference";
import { TARIFF_VERSION } from "./constants";
import { formatDutyRateFromSnapshot } from "./duty-rate-display";
import type { TariffSnapshotRow } from "@/db/schema/tariffSnapshots";

const DEFAULT_TARIFF_VERSION = TARIFF_VERSION || "ETH-2024";

export type TariffLookupResult = {
  tariffVersion: string;
  officialDescription: string;
  /** Parsed numeric rate for DB storage (e.g. 10.0000) */
  customsDutyRate: string | null;
  /** Raw rate from tariff book for display/export (e.g. "10%", "Free") */
  dutyRateDisplay: string | null;
  stdUnit: string | null;
  sourceReference: string | null;
};

export function parseDutyRate(
  dutyRate: string | null | undefined,
): string | null {
  if (!dutyRate) return null;
  const trimmed = dutyRate.trim();
  if (!trimmed) return null;

  if (/^(free|nil|exempt|0%?)$/i.test(trimmed)) {
    return "0.0000";
  }

  const cleaned = trimmed.replace(/%/g, "").trim();
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num.toFixed(4) : null;
}

function buildResultFromReference(
  ref: NonNullable<ReturnType<typeof findReferenceForHsCode>>,
  hsCode: string,
): TariffLookupResult {
  const rawDuty = ref.dutyRate?.trim() || null;
  return {
    tariffVersion: DEFAULT_TARIFF_VERSION,
    officialDescription: ref.description.replace(/^[-\s]+/, "").trim(),
    customsDutyRate: parseDutyRate(rawDuty),
    dutyRateDisplay: rawDuty,
    stdUnit: ref.stdUnit ?? null,
    sourceReference: ref.tariffNo,
  };
}

export async function lookupTariffForHsCode(
  hsCode: string,
): Promise<TariffLookupResult> {
  await loadHsReferenceCache();
  const ref = findReferenceForHsCode(hsCode);

  if (!ref) {
    return {
      tariffVersion: DEFAULT_TARIFF_VERSION,
      officialDescription: `HS ${hsCode}`,
      customsDutyRate: null,
      dutyRateDisplay: null,
      stdUnit: null,
      sourceReference: null,
    };
  }

  return buildResultFromReference(ref, hsCode);
}

type DutyRateSnapshot = Pick<
  TariffSnapshotRow,
  "customsDutyRate" | "hsCode" | "otherCharges"
> | null;

/** Resolve duty rate text for UI/export from snapshot + reference fallback. */
export function resolveDutyRateDisplay(snapshot: DutyRateSnapshot): string {
  const fromSnapshot = formatDutyRateFromSnapshot(snapshot);
  if (fromSnapshot) return fromSnapshot;

  if (!snapshot?.hsCode) return "";

  const ref =
    findInCacheSync(snapshot.hsCode) ??
    findReferenceForHsCode(snapshot.hsCode);
  return ref?.dutyRate?.trim() ?? "";
}

export function dutyRateOtherCharges(
  dutyRateDisplay: string | null,
): Record<string, string> | null {
  if (!dutyRateDisplay) return null;
  return { dutyRateDisplay };
}
