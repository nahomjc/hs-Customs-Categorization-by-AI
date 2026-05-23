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

export function normalizeLineQuantity(
  quantity: number | null | undefined
): number | null {
  if (quantity == null || Number.isNaN(quantity)) return null;
  const n = Math.floor(Number(quantity));
  if (n < 1 || n > MAX_LINE_QTY) return null;
  return n;
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
