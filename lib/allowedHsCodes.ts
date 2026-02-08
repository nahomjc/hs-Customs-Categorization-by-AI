/**
 * Allowed HS codes for assessor-style classification.
 * AI must choose ONLY from this list — never invent codes.
 * Based on common import categories: lighting, furniture, decor, HVAC, textile, hardware, ceramics, etc.
 */
export const ALLOWED_HS_CODES = [
  "9405", // Lighting (lamps, pendants, track lights)
  "9405.10",
  "9405.20",
  "9401", // Chairs & seating
  "9401.61",
  "9401.71",
  "9401.80",
  "9403", // Other furniture (tables, cabinets — not lamps)
  "9403.20",
  "9403.60",
  "6702", // Artificial flowers/plants
  "8415", // AC, refrigeration
  "8414", // Fans, extract fans
  "4814", // Wallpaper
  "3926", // Plastic articles (handles, fittings)
  "6913", // Decorative ceramics (vases, ornaments)
  "7326", // Other articles of iron/steel
  "8302", // Base metal mountings, fittings
  "8471", // Computers (if applicable)
  "8516", // Electric heating, space heaters
  "3924", // Tableware, kitchenware (plastic)
  "7308", // Structures and parts of iron/steel
  "9404", // Mattress supports, bedding (not wallpaper — use 4814)
  "6304", // Bedding, quilts (textile)
  "6302", // Bed linen
  "9703", // Sculptures and statuary (artwork — not 6702 artificial plants)
  "8413", // Pumps for liquids (e.g. fountain pumps)
  "9403.90",
  "9405.90",
  "9999", // Only for "Unclassified" when item is real but unclear — assessor fallback
] as const;

/** Real item but AI unsure — needs human review. Not a "non-item". */
export const UNKNOWN_HS = "9999";

/** Not an import good (header, address, etc.) — exclude from grouped result. */
export const EXCLUDED_HS = "EXCLUDE";

/** HS codes that mean "exclude from export" (non-goods). Never use 0000.00. */
export const EXCLUDE_HS = ["EXCLUDE", "0000.00", "0000", "9999.99"];

/** Code for items that need more description before classification (assessor rule). */
export const NEED_INFO_HS = "NEED_INFO";

/** Categories that mean "not a physical import item" — exclude from grouped result. */
export const NON_ITEM_CATEGORIES = [
  "Non-item",
  "Excluded",
  "Document",
  "Unit only",
  "Not an import item",
  "Header",
  "Noise",
];

/** Exact match only — no "starts with" or first-4-digits. Assessor does exact HS selection. */
export function isAllowedHsCode(code: string | null): boolean {
  if (!code) return false;
  const clean = code.trim();
  return (ALLOWED_HS_CODES as readonly string[]).includes(clean);
}

export function isExcludedHsCode(code: string | null): boolean {
  if (!code) return true;
  const upper = code.toUpperCase();
  if (EXCLUDE_HS.some((ex) => upper === ex || upper.startsWith(ex)))
    return true;
  if (code === "9999.99" || code.startsWith("0000")) return true;
  return false;
}

export function isNonItemCategory(category: string | null): boolean {
  if (!category) return false;
  const c = category.trim().toLowerCase();
  return NON_ITEM_CATEGORIES.some((n) => c.includes(n.toLowerCase()));
}

/**
 * Senior-assessor validation: category gate first, then exact HS.
 * Use after AI + assessor rules as last line of defense.
 */
export function validateClassification({
  hsCode,
  category,
}: {
  hsCode: string | null;
  category: string | null;
}): { status: "exclude" | "review" | "valid"; hsCode: string } {
  // Step 1: Not a real item → exclude
  if (isNonItemCategory(category)) {
    return { status: "exclude", hsCode: EXCLUDED_HS };
  }

  // Step 2: AI said unsure (real item) → review bucket
  if (
    hsCode === UNKNOWN_HS ||
    hsCode === "9999.00" ||
    hsCode?.startsWith("9999.")
  ) {
    return { status: "review", hsCode: UNKNOWN_HS };
  }

  // Step 3: Exact allowed code → valid
  if (isAllowedHsCode(hsCode)) {
    return { status: "valid", hsCode: hsCode!.trim() };
  }

  // Step 4: AI mistake (hallucinated subcode) → force review, do not trust code
  return { status: "review", hsCode: UNKNOWN_HS };
}
