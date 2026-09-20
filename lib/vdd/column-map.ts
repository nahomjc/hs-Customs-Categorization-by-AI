/** Canonical VDD reference record field keys used in column mapping. */
export const VDD_FIELD_KEYS = [
  "importer_name",
  "declaration_number",
  "hs_code",
  "unit_of_quantity",
  "origin_code",
  "country_name",
  "brand_or_make",
  "model",
  "common_name",
  "condition",
  "commercial_description",
  "appearance",
  "material",
  "size",
  "product_type",
  "diameter",
  "width",
  "length",
  "declared_unit_price",
  "net_mass",
  "gross_mass",
  "currency_code",
] as const;

export type VddFieldKey = (typeof VDD_FIELD_KEYS)[number];

export type VddColumnMappings = Partial<Record<VddFieldKey, string>>;

/** Excel header text → canonical field (case/whitespace insensitive match). */
export const DEFAULT_HEADER_ALIASES: Record<string, VddFieldKey> = {
  importer: "importer_name",
  "importer name": "importer_name",
  "declaration number": "declaration_number",
  "declaration number:": "declaration_number",
  "hs code": "hs_code",
  hscode: "hs_code",
  "h.s. code": "hs_code",
  "unit of quantity": "unit_of_quantity",
  "unit of quantity:": "unit_of_quantity",
  origin: "origin_code",
  "origin code": "origin_code",
  country: "country_name",
  "country name": "country_name",
  "brand or make": "brand_or_make",
  brand: "brand_or_make",
  make: "brand_or_make",
  model: "model",
  "common name": "common_name",
  "condition new": "condition",
  condition: "condition",
  "commercial description": "commercial_description",
  appearance: "appearance",
  matrial: "material",
  material: "material",
  size: "size",
  type: "product_type",
  "product type": "product_type",
  diameter: "diameter",
  width: "width",
  length: "length",
  "unite price(declared)": "declared_unit_price",
  "unit price(declared)": "declared_unit_price",
  "unit price (declared)": "declared_unit_price",
  "declared unit price": "declared_unit_price",
  "net mass": "net_mass",
  "gross mass": "gross_mass",
  "curreny (defult usd)": "currency_code",
  "currency (default usd)": "currency_code",
  currency: "currency_code",
  curreny: "currency_code",
};

export function normalizeHeaderKey(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/appearance\s*\([^)]*\)/i, "appearance");
}

/**
 * Detect column mappings from header row values.
 * Returns map of field → original header string.
 */
export function detectColumnMappings(
  headers: string[],
): VddColumnMappings {
  const mappings: VddColumnMappings = {};
  const usedHeaders = new Set<string>();

  for (const header of headers) {
    if (!header.trim()) continue;
    const normalized = normalizeHeaderKey(header);
    const field = DEFAULT_HEADER_ALIASES[normalized];
    if (field && !mappings[field] && !usedHeaders.has(header)) {
      mappings[field] = header;
      usedHeaders.add(header);
    }
  }

  return mappings;
}

export function invertMappings(
  mappings: VddColumnMappings,
): Map<string, VddFieldKey> {
  const inverted = new Map<string, VddFieldKey>();
  for (const [field, header] of Object.entries(mappings) as [
    VddFieldKey,
    string,
  ][]) {
    if (header) inverted.set(header, field);
  }
  return inverted;
}

export const VDD_FIELD_LABELS: Record<VddFieldKey, string> = {
  importer_name: "Importer",
  declaration_number: "Declaration number",
  hs_code: "HS code",
  unit_of_quantity: "Unit of quantity",
  origin_code: "Origin",
  country_name: "Country",
  brand_or_make: "Brand or make",
  model: "Model",
  common_name: "Common name",
  condition: "Condition",
  commercial_description: "Commercial description",
  appearance: "Appearance",
  material: "Material",
  size: "Size",
  product_type: "Type",
  diameter: "Diameter",
  width: "Width",
  length: "Length",
  declared_unit_price: "Declared unit price",
  net_mass: "Net mass",
  gross_mass: "Gross mass",
  currency_code: "Currency",
};
