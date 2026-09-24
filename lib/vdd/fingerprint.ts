/**
 * Stable VDD row fingerprint for dedupe / fill-empty upserts.
 * Same HS alone is NOT a duplicate — history per HS is expected.
 */

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export type VddFingerprintInput = {
  declarationNumber?: string | null;
  hsCode: string;
  brandOrMake?: string | null;
  model?: string | null;
  originCode?: string | null;
  declaredUnitPrice?: string | null;
  commercialDescription?: string | null;
  commonName?: string | null;
};

/**
 * Prefer declaration + HS + brand + model when declaration exists.
 * Otherwise fall back to HS + brand + model + origin + price + description.
 */
export function buildVddDedupeKey(input: VddFingerprintInput): string {
  const hs = norm(input.hsCode);
  const brand = norm(input.brandOrMake);
  const model = norm(input.model);
  const decl = norm(input.declarationNumber);

  if (decl) {
    return `d:${decl}|hs:${hs}|b:${brand}|m:${model}`.slice(0, 512);
  }

  const origin = norm(input.originCode);
  const price = norm(input.declaredUnitPrice);
  const desc = norm(input.commercialDescription || input.commonName);
  return `hs:${hs}|b:${brand}|m:${model}|o:${origin}|p:${price}|c:${desc}`.slice(
    0,
    512,
  );
}

/** Slug for custom VDD column keys (tenant-unique). */
export function slugifyVddFieldKey(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return base || "custom_field";
}
