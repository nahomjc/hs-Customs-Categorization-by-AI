/**
 * Normalize VDD Excel cell values for storage.
 * HS codes like "54023300.0" become "54023300" (bare digits, no Excel float suffix).
 */

const TEXT_TITLE_FIELDS = new Set([
  "importer_name",
  "brand_or_make",
  "model",
  "common_name",
  "condition",
  "material",
  "product_type",
  "country_name",
]);

export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    // Avoid scientific notation / float noise for HS-like integers
    if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-9) {
      return String(Math.round(value));
    }
    return String(value);
  }
  return String(value).trim();
}

/** Convert Excel HS values such as 54023300.0 / "54023300.0" → "54023300". */
export function normalizeVddHsCode(raw: unknown): string | null {
  let s = cellToString(raw);
  if (!s) return null;

  // Excel often stores HS as float: "54023300.0"
  if (/^\d+\.0+$/.test(s)) {
    s = s.replace(/\.0+$/, "");
  }

  s = s.replace(/\s/g, "").replace(/,/g, "");

  // Strip trailing .0 after other cleanup
  if (/^\d+\.0+$/.test(s)) {
    s = s.replace(/\.0+$/, "");
  }

  // Keep dotted HS (e.g. 5402.3300) as digits only for VDD storage consistency
  if (/^\d{4}\.\d{2,4}$/.test(s)) {
    const [h, sub] = s.split(".");
    s = `${h}${sub.padEnd(4, "0").slice(0, 4)}`;
  }

  // Digits only (4–12 typical customs codes)
  const digits = s.replace(/\D/g, "");
  if (digits.length < 4 || digits.length > 12) return null;

  // Plausible chapter 01–97
  const chapter = Number.parseInt(digits.slice(0, 2), 10);
  if (chapter < 1 || chapter > 97) return null;

  return digits;
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Light capitalization normalize: collapse spaces, trim; keep ALLCAPS brands as-is if short. */
export function normalizeTextCase(value: string): string {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return "";
  // Model numbers / codes: leave mostly as-is after whitespace normalize
  if (/^[A-Z0-9][A-Z0-9.\-_/]*$/i.test(trimmed) && /[0-9]/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  // Title-ish for multi-word names
  return trimmed
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeCurrencyCode(raw: unknown): string {
  const s = cellToString(raw).toUpperCase().replace(/[^A-Z]/g, "");
  if (!s || s === "USD" || s.length !== 3) return "USD";
  return s.slice(0, 3);
}

export function parseOptionalNumber(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    return String(raw);
  }
  const s = cellToString(raw).replace(/,/g, "");
  if (!s) return null;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return String(n);
}

export function normalizeOriginCode(raw: unknown): string | null {
  const s = cellToString(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return null;
  return s.slice(0, 10);
}

export function normalizeTextField(
  field: string,
  raw: unknown,
): string | null {
  const s = cellToString(raw);
  if (!s) return null;
  const collapsed = normalizeWhitespace(s);
  if (!collapsed) return null;
  if (TEXT_TITLE_FIELDS.has(field)) {
    return normalizeTextCase(collapsed);
  }
  return collapsed;
}

/**
 * Soft data-quality flags. Rows are still importable when HS is valid.
 */
export function buildDataQualityFlags(input: {
  hsCode: string;
  appearance: string | null;
  material: string | null;
  commonName: string | null;
  commercialDescription: string | null;
}): string[] {
  const flags: string[] = [];
  const appearance = (input.appearance ?? "").toUpperCase();
  const material = (input.material ?? "").toLowerCase();
  const name = `${input.commonName ?? ""} ${input.commercialDescription ?? ""}`.toLowerCase();

  if (
    appearance.includes("LIQUID") &&
    (material.includes("polyester") ||
      material.includes("yarn") ||
      name.includes("yarn") ||
      name.includes("fabric") ||
      name.includes("textile"))
  ) {
    flags.push(
      "Appearance marked LIQUID but product text suggests solid textile/yarn",
    );
  }

  if (
    appearance.includes("POWDER") &&
    (name.includes("motor") ||
      name.includes("machine") ||
      name.includes("engine"))
  ) {
    flags.push(
      "Appearance marked POWDER but product text suggests machinery",
    );
  }

  return flags;
}

export function buildNormalizedSearchText(parts: {
  commonName: string | null;
  commercialDescription: string | null;
  brandOrMake: string | null;
  model: string | null;
  productType: string | null;
  material: string | null;
  condition: string | null;
  countryName: string | null;
  originCode: string | null;
  hsCode: string;
}): string {
  return [
    parts.commonName,
    parts.commercialDescription,
    parts.brandOrMake,
    parts.model,
    parts.productType,
    parts.material,
    parts.condition,
    parts.countryName,
    parts.originCode,
    parts.hsCode,
  ]
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
