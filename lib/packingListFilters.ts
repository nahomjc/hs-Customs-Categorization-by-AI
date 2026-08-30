/** Filters for packing-list lines (OCR noise, headers, addresses). */

const NON_ITEM_PATTERNS: RegExp[] = [
  /^\s*address\s*[:]/i,
  /^\s*telephone\s*[:]/i,
  /^\s*tel\s*[:.]/i,
  /^\s*phone\s*[:]/i,
  /^\s*fax\s*[:]/i,
  /^\s*email\s*[:]/i,
  /^\s*e-?mail\s*[:]/i,
  /\bpacking\s*list\b/i,
  /\bcommercial\s*invoice\b/i,
  /\bproforma\b/i,
  /\btin\s*no\b/i,
  /\btax\s*id\b/i,
  /^description\s+of\s+goods/i,
  /^hs\s*code\b/i,
  /^specification\b/i,
  /^unit\s+of\s+measure/i,
  /^gw\s*\(?\s*kg/i,
  /^nw\s*\(?\s*kg/i,
  /gross\s*weight/i,
  /net\s*weight/i,
  /^total\b/i,
  /^sub\s*total/i,
  /^grand\s*total/i,
  /^ethiopia\s*$/i,
  /^original\s*$/i,
  /^dashen\s*bank/i,
  /share\s*company/i,
  /^\s*\d+\s*$/,
  /\binvoice\s*(no\.?|number|#)?\b/i,
  /\bpfi\s*(no\.?|number|#)?\b/i,
  /\bptfze\b/i,
  /\bpf\s*i\s*number\b/i,
  /\bproforma\s*invoice\b/i,
];

const METADATA_COMBO =
  /\baddress\s*[:;]?\s*.*\b(telephone|tel|phone)\s*[:;]?/i;

const MAX_LINE_QTY = 5000;
const MIN_PRODUCT_LETTERS = 2;

const PACKING_UNIT_CAPTURE =
  /(PCS?|PIECES?|SETS?|SET|UNITS?|BOX(?:ES)?|CARTONS?|CTNS?|ROLLS?|SQM|SQ\.?M\.?|SKETCHES?|Pcs)/i;

/** YAMATA-style rows: `... China 8 PCS 8 93 0,84` — qty is the number before the unit. */
const YAMATA_QTY_PATTERN = new RegExp(
  String.raw`\b(?:China|RE)\s+(\d{1,4})\s+${PACKING_UNIT_CAPTURE.source}\b`,
  "i",
);

/** Merged tail: `... PCS 1 15 0,15` when country column is missing from OCR. */
const EMBEDDED_PCS_QTY_PATTERN = new RegExp(
  String.raw`\b${PACKING_UNIT_CAPTURE.source}\s+(\d{1,4})(?:\s+\d+(?:[.,]\d+)?\s*){1,2}$`,
  "i",
);

export function normalizeLineQuantity(
  quantity: number | null | undefined
): number | null {
  if (quantity == null || Number.isNaN(quantity)) return null;
  const n = Math.floor(Number(quantity));
  if (n < 1 || n > MAX_LINE_QTY) return null;
  return n;
}

/** Normalize unit strings from packing lists. */
export function normalizePackingUnit(raw: string): string {
  const u = raw.toUpperCase().replace(/\./g, "");
  if (u === "PC" || u === "PIECE" || u === "PIECES") return "PCS";
  if (u === "CTN" || u === "CARTON" || u === "CARTONS") return "CTNS";
  if (u === "SET" || u === "SETS") return "SET";
  if (u === "ROLL" || u === "ROLLS") return "ROLLS";
  if (u === "SQM" || u === "SQ M") return "SQM";
  if (u === "SKETCHE" || u === "SKETCHES") return "PCS";
  return u;
}

/**
 * Extract piece/carton quantity from common packing-list OCR patterns.
 * Prefer this over a trailing number on the description (e.g. Handles-50).
 */
export function extractPackingListQuantity(
  line: string,
): { quantity: number; unit: string } | null {
  const text = line.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const yamata = text.match(YAMATA_QTY_PATTERN);
  if (yamata) {
    const quantity = normalizeLineQuantity(Number.parseInt(yamata[1], 10));
    if (quantity) {
      return { quantity, unit: normalizePackingUnit(yamata[2]) };
    }
  }

  const embedded = text.match(EMBEDDED_PCS_QTY_PATTERN);
  if (embedded) {
    const quantity = normalizeLineQuantity(Number.parseInt(embedded[2], 10));
    if (quantity) {
      return { quantity, unit: normalizePackingUnit(embedded[1]) };
    }
  }

  return null;
}

/** Remove packing qty/unit tokens so the remainder is the product description. */
export function stripPackingListQuantityTokens(line: string): string {
  return line
    .replace(YAMATA_QTY_PATTERN, " ")
    .replace(EMBEDDED_PCS_QTY_PATTERN, " ")
    .replace(/\b(?:China|RE)\s*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drop qty when it is a model suffix (e.g. Handles-50) rather than a packing count. */
export function rejectModelSuffixQuantity(
  line: string,
  quantity: number | null,
): number | null {
  if (quantity == null) return null;
  const modelSuffix = line.match(
    /(?:handles?|pull|size|model|type|no\.?|#)\s*[-–]?\s*(\d{2,3})\b/i,
  );
  if (modelSuffix && Number.parseInt(modelSuffix[1], 10) === quantity) {
    return null;
  }
  return quantity;
}

export function isNonItemLine(
  description: string,
  rawLine?: string | null
): boolean {
  const desc = description.trim();
  const raw = (rawLine ?? "").trim();
  const combined = `${desc} ${raw}`.replace(/\s+/g, " ").trim();

  if (combined.length < 3) return true;
  if (METADATA_COMBO.test(combined)) return true;

  for (const p of NON_ITEM_PATTERNS) {
    if (p.test(desc) || p.test(raw) || p.test(combined)) return true;
  }

  if (/^\+\d{2,3}[\s-]?\d{6,}$/.test(desc.replace(/\s/g, ""))) return true;
  if (
    /\b(telephone|tel)\b/i.test(combined) &&
    !/\b(lamp|chair|box|plate|fan|tea|sausage|noodle|juice|oven|kettle|scissor|hook|towel|cup|wardrobe)\b/i.test(
      combined
    )
  ) {
    return true;
  }

  const letters = (desc.match(/[a-zA-Z]/g) ?? []).length;
  if (letters < MIN_PRODUCT_LETTERS) return true;

  if (/\d{7,}/.test(combined) && !/\d{4}\.\d{2,4}/.test(combined)) {
    return true;
  }

  if (
    /\baddress\b/i.test(combined) &&
    /\b(telephone|tel|phone|ethiopia)\b/i.test(combined)
  ) {
    return true;
  }

  return false;
}

/** Strip OCR table cell markers: `| 6 | Chicken feet |` → `Chicken feet`. */
export function cleanProductDescription(description: string): string {
  let d = description.trim();
  const pipeWrapped = d.match(
    /^\|\s*(\d{1,3}#?)\s*\|\s*([\s\S]+?)\s*\|?\s*$/
  );
  if (pipeWrapped) return pipeWrapped[2].trim();
  d = d.replace(/^\|\s*\d{1,3}#?\s*\|\s*/i, "").replace(/\s*\|\s*$/g, "");
  return d.replace(/\s+/g, " ").trim();
}

export function isValidProductDescription(description: string): boolean {
  const d = cleanProductDescription(description);
  if (d.length < 2) return false;
  if (isNonItemLine(d)) return false;
  if (/^[0-9.\s+#:|]+$/.test(d)) return false;
  return true;
}
