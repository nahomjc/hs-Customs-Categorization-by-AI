/**
 * Country of origin for declaration groups and the export. Uses the real
 * stored data only: the product, its invoice / packing lines, then the case
 * (origin, else country of export, else supplier country: the same order the
 * dashboard map uses). Nothing is guessed; "missing" stays missing.
 */

export const ORIGIN_NOT_PROVIDED = "Not provided";

/** Placeholder written into group keys when no origin exists anywhere. */
export const ORIGIN_UNKNOWN_KEY = "UNK";

function clean(code: string | null | undefined): string | null {
  const c = (code ?? "").trim().toUpperCase();
  return c && c !== ORIGIN_UNKNOWN_KEY ? c : null;
}

/** Case-level fallback: origin, else country of export, else supplier country. */
export function caseOriginFallback(caseInfo: {
  countryOfOriginCode?: string | null;
  countryOfExportCode?: string | null;
  supplierCountryCode?: string | null;
} | null | undefined): string | null {
  return (
    clean(caseInfo?.countryOfOriginCode) ??
    clean(caseInfo?.countryOfExportCode) ??
    clean(caseInfo?.supplierCountryCode)
  );
}

export function resolveProductOrigin(input: {
  productOrigin?: string | null;
  invoiceOrigins?: Array<string | null | undefined>;
  packingOrigins?: Array<string | null | undefined>;
  caseOrigin?: string | null;
}): string | null {
  return (
    clean(input.productOrigin) ??
    (input.invoiceOrigins ?? []).map(clean).find(Boolean) ??
    (input.packingOrigins ?? []).map(clean).find(Boolean) ??
    clean(input.caseOrigin) ??
    null
  );
}

/** Text for a screen / export: the code, or "Not provided" (never "UNK"). */
export function displayOrigin(code: string | null | undefined): string {
  return clean(code) ?? ORIGIN_NOT_PROVIDED;
}