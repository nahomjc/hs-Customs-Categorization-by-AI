/**
 * Column mapping for spreadsheet imports (invoice / packing list).
 *
 * Pure module (no DB, no React, no Node APIs) so it can be unit-tested with tsx
 * and shared between the API routes and the import pipeline.
 *
 * Flow: normalize headers -> score every (column, field) pair with a synonym
 * dictionary -> content-based fallback for fields still unmapped -> decide
 * whether the suggestion is "sure" or the user has to confirm it.
 */

export type MappingDocKind = "invoice" | "packing_list";

export type Cell = string | number | null;

export type FieldType =
  | "text"
  | "integer"
  | "number"
  | "unit"
  | "currency"
  | "country"
  | "hs";

export type FieldDef = {
  key: string;
  label: string;
  /** Must be mapped before the import can run. */
  required?: boolean;
  /** At least one field of the group must be mapped (e.g. unit price OR total). */
  requiredGroup?: string;
  /** "column" = dedicated DB column, "extra" = stored in the `extra` jsonb. */
  storage: "column" | "extra";
  type: FieldType;
  /** Normalized header equals one of these -> score 1.0 */
  exact: string[];
  /** Normalized header contains one of these phrases -> score 0.88 */
  contains?: string[];
  /** Weaker hints (exact or contained) -> score 0.7 (medium) */
  weak?: string[];
  /** Hint shown in the UI */
  hint?: string;
};

export type Confidence = "high" | "medium" | "low" | "none";

export type FieldSuggestion = {
  fieldKey: string;
  columnIndex: number | null;
  confidence: Confidence;
  score: number;
  source: "header" | "content" | "saved" | "none";
  /** Another column matched this field just as well. */
  ambiguous: boolean;
  alternatives: Array<{ columnIndex: number; score: number }>;
};

export type MappingAnalysis = {
  kind: MappingDocKind;
  suggestions: Record<string, FieldSuggestion>;
  /** true when the suggestion can be imported without asking the user. */
  sure: boolean;
  /** Why the user has to confirm (empty when sure). */
  reasons: string[];
  /** Non-blocking notes about the file / defaults that will be applied. */
  warnings: string[];
  /** Source columns that are not mapped to any field. */
  unmappedColumns: number[];
};

/** Column indexes per field + what to do with every other column. */
export type ColumnMapping = {
  fields: Record<string, number | null>;
  /** key = column index (string), default for missing keys is "extra". */
  extraColumns?: Record<string, "extra" | "ignore">;
};

/** Portable, header-based representation that is stored in the DB. */
export type SavedColumnMapping = {
  fields: Record<string, string | null>;
  extraColumns: Record<string, "extra" | "ignore">;
};

// ---------------------------------------------------------------------------
// Field dictionaries
// ---------------------------------------------------------------------------

const F_LINE_NO: FieldDef = {
  key: "lineNumber",
  label: "Line no.",
  storage: "column",
  type: "integer",
  exact: [
    "no", "item", "item no", "line", "line no", "line number", "line item",
    "sn", "s n", "sr no", "sr", "serial", "serial no", "serial number",
    "seq", "sequence", "sl no", "sl", "number", "nr", "pos", "position",
  ],
};

const F_DESCRIPTION: FieldDef = {
  key: "supplierDescription",
  label: "Description",
  required: true,
  storage: "column",
  type: "text",
  exact: [
    "description", "description of goods", "goods description", "goods",
    "goods name", "name of goods", "product", "product name",
    "product description", "item description", "description of item",
    "description of product", "description of commodity", "commodity",
    "commodity description", "particulars", "material description", "material",
    "article", "article description", "item name", "desc", "descriptions",
    "name", "name of product", "product description and specification",
  ],
  contains: ["description", "goods", "commodity", "product name"],
  weak: ["product", "particulars", "item name", "material"],
};

const F_SPEC: FieldDef = {
  key: "specification",
  label: "Specification",
  storage: "extra",
  type: "text",
  exact: ["specification", "specifications", "spec", "specs", "size", "packing spec", "specification and model"],
  contains: ["specification"],
};

const F_HS: FieldDef = {
  key: "hsCode",
  label: "HS code",
  storage: "extra",
  type: "hs",
  exact: [
    "hs code", "hs", "hscode", "hs no", "hs number", "hts", "hts code", "hts no",
    "harmonized code", "harmonised code", "harmonized system code", "tariff code",
    "tariff no", "tariff number", "tariff", "commodity code", "customs code",
    "customs tariff", "customs tariff no", "hs tariff",
  ],
  contains: ["hs code", "hts code", "tariff code", "harmonized"],
};

const F_SKU: FieldDef = {
  key: "supplierSku",
  label: "SKU / item code",
  storage: "column",
  type: "text",
  exact: ["sku", "item code", "product code", "part no", "part number", "pn", "article no", "article number", "code", "material no", "material code", "item number", "product no"],
  contains: ["item code", "product code", "part number", "part no", "sku"],
};

const F_BRAND: FieldDef = {
  key: "brand",
  label: "Brand",
  storage: "column",
  type: "text",
  exact: ["brand", "brand name", "make", "manufacturer", "maker", "trade mark", "trademark"],
};

const F_MODEL: FieldDef = {
  key: "modelNumber",
  label: "Model",
  storage: "column",
  type: "text",
  exact: ["model", "model no", "model number", "type", "model type", "style", "item model"],
  contains: ["model no", "model number"],
};

const F_QTY: FieldDef = {
  key: "quantity",
  label: "Quantity",
  required: true,
  storage: "column",
  type: "number",
  exact: [
    "qty", "quantity", "quantities", "qnty", "qty pcs", "quantity pcs", "order qty",
    "shipped qty", "quantity shipped", "invoice qty", "total qty", "total quantity",
    "q ty", "qty shipped",
  ],
  contains: ["quantity", "qty"],
  weak: ["pcs", "pieces", "units", "no of pcs", "number of pieces"],
};

const F_UNIT: FieldDef = {
  key: "unitOfMeasure",
  label: "Unit",
  storage: "column",
  type: "unit",
  exact: ["unit", "uom", "unit of measure", "unit of measurement", "unit measure", "measure", "um", "unit type", "measurement unit", "units of measure"],
  contains: ["unit of measure", "uom"],
};

const F_UNIT_PRICE: FieldDef = {
  key: "unitPrice",
  label: "Unit price",
  requiredGroup: "price",
  storage: "column",
  type: "number",
  exact: [
    "unit price", "unit value", "price", "unit cost", "price per unit", "rate",
    "unit rate", "fob price", "unit fob", "fob unit price", "cif price", "price unit",
    "unit amount", "selling price", "u price", "unit prices",
  ],
  contains: ["unit price", "unit value", "unit cost", "price per"],
  weak: ["price", "rate"],
};

const F_TOTAL: FieldDef = {
  key: "lineTotalAmount",
  label: "Total / amount",
  requiredGroup: "price",
  storage: "column",
  type: "number",
  exact: [
    "amount", "total", "total value", "total amount", "line total", "total price",
    "extended price", "extended amount", "line amount", "value", "total cost",
    "sum", "ext amount", "amt", "total fob", "fob value", "fob amount", "line value",
    "total prices", "subtotal", "sub total",
  ],
  contains: ["total value", "total amount", "line total", "total price", "line amount"],
  weak: ["total", "amount", "value"],
};

const F_CURRENCY: FieldDef = {
  key: "currencyCode",
  label: "Currency",
  storage: "column",
  type: "currency",
  exact: ["currency", "curr", "ccy", "currency code", "cur"],
};

const F_ORIGIN: FieldDef = {
  key: "countryOfOriginCode",
  label: "Country of origin",
  storage: "column",
  type: "country",
  exact: ["origin", "country of origin", "coo", "made in", "origin country", "c o o", "country", "country origin", "place of origin"],
  contains: ["country of origin", "origin"],
};

const F_DECL_NET: FieldDef = {
  key: "declaredNetWeightKg",
  label: "Net weight (kg)",
  storage: "column",
  type: "number",
  exact: ["net weight", "net wt", "nw", "n w", "net", "total net weight", "net weight kgs", "netto"],
  contains: ["net weight", "net wt"],
  weak: ["nw", "net"],
};

const F_DECL_GROSS: FieldDef = {
  key: "declaredGrossWeightKg",
  label: "Gross weight (kg)",
  storage: "column",
  type: "number",
  exact: ["gross weight", "gross wt", "gw", "g w", "gross", "total gross weight", "gross weight kgs", "brutto"],
  contains: ["gross weight", "gross wt"],
  weak: ["gw", "gross"],
};

// Packing list specific -----------------------------------------------------

const P_PACKAGE_TYPE: FieldDef = {
  key: "packageType",
  label: "Package type",
  storage: "column",
  type: "text",
  exact: ["package type", "packing type", "packaging", "packing", "kind of package", "type of package", "pack type", "packaging type", "type of packing"],
  contains: ["package type", "packing type", "kind of package", "type of package"],
};

const P_PACKAGES: FieldDef = {
  key: "numberOfPackages",
  label: "Packages / cartons",
  requiredGroup: "qtyOrPackages",
  storage: "column",
  type: "number",
  exact: [
    "packages", "no of packages", "number of packages", "ctns", "ctn", "cartons",
    "no of ctns", "no of cartons", "number of cartons", "number of ctns", "pkgs",
    "no of pkgs", "package qty", "packages qty", "carton qty", "ctn qty", "qty ctns",
    "ctns qty", "package", "carton", "cartons qty", "total cartons", "total packages",
    "no of package", "no of carton", "packages count", "cartons count",
  ],
  contains: ["number of packages", "no of packages", "no of ctns", "no of cartons", "number of cartons", "no of pkgs"],
  weak: ["ctns", "cartons", "packages"],
};

const P_PIECES_PER_PACKAGE: FieldDef = {
  key: "piecesPerPackage",
  label: "Pieces per package",
  storage: "column",
  type: "number",
  exact: [
    "pcs ctn", "pcs per ctn", "pcs per carton", "qty per carton", "qty ctn", "pieces per package",
    "pieces per carton", "units per carton", "pcs per package", "qty per ctn", "pcs pkg",
    "packing qty", "quantity per carton", "quantity per package", "per carton", "per ctn",
  ],
  contains: ["per carton", "per ctn", "per package", "pcs ctn"],
};

const P_NET: FieldDef = { ...F_DECL_NET, key: "netWeightKg" };
const P_GROSS: FieldDef = { ...F_DECL_GROSS, key: "grossWeightKg" };

const P_MARKS: FieldDef = {
  key: "packageMarks",
  label: "Package marks",
  storage: "column",
  type: "text",
  exact: ["marks", "shipping marks", "marks and numbers", "marks numbers", "carton no", "ctn no", "carton number", "package marks", "package no", "pkg no", "carton nos", "ctn nos", "marks nos"],
  contains: ["shipping marks", "marks and numbers", "carton no", "ctn no", "package marks"],
};

const P_CBM: FieldDef = {
  key: "cbm",
  label: "CBM / volume",
  storage: "extra",
  type: "number",
  exact: ["cbm", "volume", "m3", "cubic meter", "cubic metre", "cubic meters", "measurement", "meas", "total cbm", "volume cbm", "cu m"],
  contains: ["cbm", "cubic"],
};

const P_DIMENSIONS: FieldDef = {
  key: "dimensions",
  label: "Dimensions",
  storage: "extra",
  type: "text",
  exact: ["dimension", "dimensions", "carton size", "carton dimension", "package size", "size cm", "l w h", "lwh", "carton measurement"],
  contains: ["dimension", "carton size", "package size"],
};

/** Packing list quantity: same synonyms as invoice quantity, but required via group. */
const P_QTY: FieldDef = { ...F_QTY, required: false, requiredGroup: "qtyOrPackages" };

export const FIELD_DEFS: Record<MappingDocKind, FieldDef[]> = {
  invoice: [
    F_LINE_NO, F_DESCRIPTION, F_SPEC, F_HS, F_SKU, F_BRAND, F_MODEL, F_QTY, F_UNIT,
    F_UNIT_PRICE, F_TOTAL, F_CURRENCY, F_ORIGIN, F_DECL_NET, F_DECL_GROSS,
  ],
  packing_list: [
    F_LINE_NO, F_DESCRIPTION, F_SPEC, F_HS, F_SKU, F_BRAND, F_MODEL, P_QTY, F_UNIT,
    P_PACKAGE_TYPE, P_PACKAGES, P_PIECES_PER_PACKAGE, P_NET, P_GROSS, P_MARKS, P_CBM,
    P_DIMENSIONS, F_ORIGIN,
  ],
};

export function getFieldDefs(kind: MappingDocKind): FieldDef[] {
  return FIELD_DEFS[kind];
}

export function getFieldDef(kind: MappingDocKind, key: string): FieldDef | undefined {
  return FIELD_DEFS[kind].find((f) => f.key === key);
}

// ---------------------------------------------------------------------------
// Header normalization
// ---------------------------------------------------------------------------

const CURRENCY_WORDS =
  /\b(usd|eur|rmb|cny|etb|gbp|aed|inr|jpy|birr)\b|us\$|[$\u20ac\u00a3\u00a5]/g;

/** Readable label for the UI: line breaks and extra spaces collapsed. */
export function cleanHeaderLabel(raw: unknown): string {
  return String(raw ?? "")
    .normalize("NFKC")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Canonical comparison form: lowercase, NFKC (full-width brackets become ASCII),
 * bracketed notes dropped, currency words dropped, punctuation removed.
 *   "UNIT VALUE\n(USD)" -> "unit value"      "Amount （USD）" -> "amount"
 *   "G.W. (KGS)" -> "gw"                      "S/N" -> "sn"
 */
export function normalizeHeader(raw: unknown): string {
  let s = String(raw ?? "").normalize("NFKC").toLowerCase();
  s = s.replace(/[\r\n\t]+/g, " ");
  s = s.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ");
  // single-letter abbreviations: n.w. g/w s/n c.b.m -> nw gw sn cbm
  s = s.replace(
    /(^|[^a-z])([a-z])[./]([a-z])(?:[./]([a-z]))?(?=[^a-z]|$)[./]?/g,
    (_m, pre: string, a: string, b: string, c?: string) => `${pre}${a}${b}${c ?? ""}`,
  );
  s = s.replace(/#/g, " no ");
  s = s.replace(CURRENCY_WORDS, " ");
  s = s.replace(/[.,:;'"`!?]/g, "");
  s = s.replace(/[_\-/\\&+*=|<>~^]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // trailing measurement tokens: "gross weight kg" -> "gross weight"
  const tokens = s.split(" ");
  if (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    if (/^(kg|kgs|lbs?|cm|mm|m3)$/.test(last)) {
      tokens.pop();
      s = tokens.join(" ");
    }
  }
  return s;
}

/** Detect a 3-letter currency in a raw header, e.g. "UNIT VALUE\n(USD)" -> "USD". */
export function detectCurrencyInHeader(raw: unknown): string | null {
  const s = String(raw ?? "").normalize("NFKC").toUpperCase();
  const m = s.match(/\b(USD|EUR|RMB|CNY|ETB|GBP|AED|INR|JPY)\b/);
  if (m) return m[1] === "RMB" ? "CNY" : m[1];
  if (/US\$|\$/.test(s)) return "USD";
  if (/\u20ac/.test(s)) return "EUR";
  return null;
}

function hasPhrase(norm: string, phrase: string): boolean {
  return ` ${norm} `.includes(` ${phrase} `);
}

export function headerScore(norm: string, def: FieldDef): number {
  if (!norm) return 0;
  if (def.exact.includes(norm)) return 1;
  if (def.contains?.some((p) => hasPhrase(norm, p))) return 0.88;
  if (def.weak?.some((p) => norm === p || hasPhrase(norm, p))) return 0.7;
  return 0;
}

/** Sum of best field scores across a row; used to find the header row. */
export function headerRowScore(cells: Cell[], kind?: MappingDocKind): number {
  const defs = kind
    ? FIELD_DEFS[kind]
    : [...FIELD_DEFS.invoice, ...FIELD_DEFS.packing_list];
  let total = 0;
  for (const cell of cells) {
    if (typeof cell !== "string") continue;
    const norm = normalizeHeader(cell);
    if (!norm || norm.length > 60) continue;
    let best = 0;
    for (const def of defs) {
      const sc = headerScore(norm, def);
      if (sc > best) best = sc;
    }
    total += best;
  }
  return total;
}

/** Header keys: normalized header, with "#2", "#3"... for repeats and blanks. */
export function headerKeys(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h, i) => {
    const norm = normalizeHeader(h) || `col ${i + 1}`;
    const n = (seen.get(norm) ?? 0) + 1;
    seen.set(norm, n);
    return n === 1 ? norm : `${norm}#${n}`;
  });
}

/** cyrb53 string hash -> hex. Deterministic, no crypto dependency. */
function hashString(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(16).padStart(14, "0");
}

/** Order-independent signature of the header set (same layout => same signature). */
export function headerSignature(headers: string[]): string {
  const keys = headerKeys(headers)
    .filter((k) => !k.startsWith("col "))
    .sort();
  return hashString(keys.join("|"));
}

// ---------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------

export function cellText(cell: Cell | undefined): string {
  if (cell === null || cell === undefined) return "";
  return String(cell).replace(/\s+/g, " ").trim();
}

/** Parse numbers stored as numbers or text ("1,234.50", "1.234,50", "12 kg"). */
export function parseNumber(cell: Cell | undefined): number | null {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  let s = String(cell).normalize("NFKC").trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$\u20ac\u00a3\u00a5]|us\$/gi, "").replace(/\s+/g, "");
  const m = s.match(/^(-?\+?)(\d[\d.,]*)(?:[a-z%./]*)$/i);
  if (!m) {
    const only = s.match(/^-?\+?\.\d+$/);
    if (!only) return null;
    return Number(s);
  }
  let digits = m[2];
  const sign = m[1].startsWith("-") || negative ? -1 : 1;
  const lastDot = digits.lastIndexOf(".");
  const lastComma = digits.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) digits = digits.replace(/\./g, "").replace(",", ".");
    else digits = digits.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // "1,234" or "1,234,567" => thousands; "1,5" or "12,50" => decimal comma
    digits = /^\d{1,3}(,\d{3})+$/.test(digits)
      ? digits.replace(/,/g, "")
      : digits.replace(",", ".");
  } else if (lastDot >= 0 && (digits.match(/\./g) ?? []).length > 1) {
    if (/^\d{1,3}(\.\d{3})+$/.test(digits)) digits = digits.replace(/\./g, "");
    else return null;
  }
  const n = Number(digits);
  return Number.isFinite(n) ? sign * n : null;
}

/** Round to dp decimals, killing float noise (27.500000000000004 -> "27.5"). */
export function roundDecimal(n: number, dp: number): string {
  const r = Number(n.toFixed(dp));
  return Object.is(r, -0) ? "0" : String(r);
}

const UNIT_ALIASES: Record<string, string> = {
  ctn: "CTNS", ctns: "CTNS", carton: "CTNS", cartons: "CTNS", cart: "CTNS",
  bag: "BAG", bags: "BAG",
  pc: "PCS", pcs: "PCS", piece: "PCS", pieces: "PCS", unit: "PCS", units: "PCS", ea: "PCS", each: "PCS", nos: "PCS", no: "PCS",
  set: "SET", sets: "SET",
  roll: "ROLL", rolls: "ROLL",
  box: "BOX", boxes: "BOX", bx: "BOX",
  kg: "KG", kgs: "KG", kilo: "KG", kilogram: "KG", kilograms: "KG",
  pkg: "PKG", pkgs: "PKG", package: "PKG", packages: "PKG",
  pallet: "PLT", pallets: "PLT", plt: "PLT", plts: "PLT",
  drum: "DRUM", drums: "DRUM", bottle: "BTL", bottles: "BTL", btl: "BTL",
  can: "CAN", cans: "CAN", pair: "PAIR", pairs: "PAIR", prs: "PAIR",
  m: "M", mtr: "M", mtrs: "M", meter: "M", meters: "M", metre: "M", metres: "M",
  sqm: "SQM", m2: "SQM", l: "L", ltr: "L", ltrs: "L", liter: "L", litre: "L", liters: "L", litres: "L",
  ton: "TON", tons: "TON", tonne: "TON", tonnes: "TON", mt: "TON",
};

export function normalizeUnit(raw: string | null | undefined): string | null {
  const t = (raw ?? "").normalize("NFKC").replace(/[.\s]+/g, " ").trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  return (UNIT_ALIASES[lower] ?? t.toUpperCase()).slice(0, 30);
}

export function isKnownUnit(raw: string | null | undefined): boolean {
  const t = (raw ?? "").normalize("NFKC").replace(/[.\s]+/g, " ").trim().toLowerCase();
  return !!t && t in UNIT_ALIASES;
}

/** Digits-only HS candidate (numeric cells lose leading zeros -> restore). */
export function hsDigits(cell: Cell | undefined): string | null {
  if (cell === null || cell === undefined) return null;
  const wasNumber = typeof cell === "number";
  let s = wasNumber ? String(Math.round(cell as number)) : String(cell).normalize("NFKC").trim();
  if (!wasNumber && !/^[\d.\s-]+$/.test(s)) return null;
  s = s.replace(/[^\d]/g, "");
  if (wasNumber && s.length % 2 === 1 && s.length >= 5 && s.length <= 9) s = `0${s}`;
  if (s.length < 4 || s.length > 10) return null;
  return s;
}

function looksLikeHsCell(cell: Cell | undefined): boolean {
  const d = hsDigits(cell);
  return !!d && d.length >= 6 && d.length <= 10;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

type ColumnStats = {
  nonEmpty: number;
  numericRatio: number;
  intRatio: number;
  hsRatio: number;
  unitRatio: number;
  textRatio: number;
  avgLen: number;
  sequential: boolean;
  numbers: Array<number | null>;
};

function computeStats(rows: Cell[][], colIndex: number): ColumnStats {
  let nonEmpty = 0;
  let numeric = 0;
  let ints = 0;
  let hs = 0;
  let units = 0;
  let text = 0;
  let lenSum = 0;
  let prev = -Infinity;
  let seqOk = true;
  const numbers: Array<number | null> = [];
  for (const row of rows) {
    const cell = row[colIndex] ?? null;
    const t = cellText(cell);
    if (!t) {
      numbers.push(null);
      continue;
    }
    nonEmpty++;
    const n = parseNumber(cell);
    numbers.push(n);
    if (n !== null) {
      numeric++;
      if (Number.isInteger(n)) ints++;
      if (n <= prev) seqOk = false;
      prev = n;
    } else {
      seqOk = false;
      text++;
      lenSum += t.length;
    }
    if (looksLikeHsCell(cell)) hs++;
    if (n === null && isKnownUnit(t)) units++;
  }
  const d = Math.max(nonEmpty, 1);
  return {
    nonEmpty,
    numericRatio: numeric / d,
    intRatio: ints / d,
    hsRatio: hs / d,
    unitRatio: units / d,
    textRatio: text / d,
    avgLen: text ? lenSum / text : 0,
    sequential: seqOk && numeric >= 3,
    numbers,
  };
}

export function confidenceFromScore(score: number): Confidence {
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  if (score > 0) return "low";
  return "none";
}

type Candidate = {
  col: number;
  field: string;
  score: number;
  source: "header" | "content";
};

export type AnalyzeInput = {
  kind: MappingDocKind;
  headers: string[];
  rows: Cell[][];
};

function emptySuggestion(fieldKey: string): FieldSuggestion {
  return {
    fieldKey,
    columnIndex: null,
    confidence: "none",
    score: 0,
    source: "none",
    ambiguous: false,
    alternatives: [],
  };
}

function relationHolds(a: number | null, b: number | null, c: number | null): boolean {
  if (a === null || b === null || c === null) return false;
  const prod = a * b;
  return Math.abs(prod - c) <= Math.max(0.02 * Math.abs(c), 0.011);
}

/** Find qty/price/total columns by the relation qty * price ~= total. */
function detectArithmeticTriple(
  stats: ColumnStats[],
  assigned: Map<string, number>,
  usedCols: Set<number>,
): { quantity?: number; unitPrice?: number; lineTotalAmount?: number } | null {
  const numericCols = stats
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.nonEmpty >= 2 && s.numericRatio >= 0.8)
    .map(({ i }) => i);
  const known = {
    quantity: assigned.get("quantity"),
    unitPrice: assigned.get("unitPrice"),
    lineTotalAmount: assigned.get("lineTotalAmount"),
  };
  let best: { q: number; p: number; t: number; ratio: number } | null = null;
  for (const t of numericCols) {
    for (const x of numericCols) {
      if (x === t) continue;
      for (const y of numericCols) {
        if (y === t || y <= x) continue;
        // x, y factors (unordered), t product
        const rowsN = stats[t].numbers.length;
        let ok = 0;
        let total = 0;
        for (let r = 0; r < rowsN; r++) {
          const a = stats[x].numbers[r];
          const b = stats[y].numbers[r];
          const c = stats[t].numbers[r];
          if (a === null || b === null || c === null) continue;
          total++;
          if (relationHolds(a, b, c)) ok++;
        }
        if (total < 2 || ok / total < 0.8) continue;
        // quantity = the more "integer" factor, ties -> lower index
        const qIsX =
          stats[x].intRatio > stats[y].intRatio ||
          (stats[x].intRatio === stats[y].intRatio && x < y);
        const q = qIsX ? x : y;
        const p = qIsX ? y : x;
        if (known.quantity !== undefined && known.quantity !== q) continue;
        if (known.unitPrice !== undefined && known.unitPrice !== p) continue;
        if (known.lineTotalAmount !== undefined && known.lineTotalAmount !== t) continue;
        // never steal columns already used by other fields
        const stolen = [q, p, t].some(
          (c) =>
            usedCols.has(c) &&
            c !== known.quantity &&
            c !== known.unitPrice &&
            c !== known.lineTotalAmount,
        );
        if (stolen) continue;
        const ratio = ok / total;
        if (!best || ratio > best.ratio) best = { q, p, t, ratio };
      }
    }
  }
  if (!best) return null;
  return { quantity: best.q, unitPrice: best.p, lineTotalAmount: best.t };
}

export function analyzeColumns(input: AnalyzeInput): MappingAnalysis {
  const { kind, headers } = input;
  const rows = input.rows.slice(0, 200);
  const defs = FIELD_DEFS[kind];
  const norms = headers.map((h) => normalizeHeader(h));
  const stats = headers.map((_, i) => computeStats(rows, i));

  // 1) header candidates
  const candidates: Candidate[] = [];
  const perFieldCandidates = new Map<string, Candidate[]>();
  for (const def of defs) {
    const list: Candidate[] = [];
    for (let col = 0; col < headers.length; col++) {
      const score = headerScore(norms[col], def);
      if (score <= 0) continue;
      // sanity: numeric fields should look numeric when there is data
      let adj = score;
      const st = stats[col];
      if (st.nonEmpty >= 3) {
        if ((def.type === "number" || def.type === "integer") && st.numericRatio < 0.5) adj = Math.min(adj, 0.55);
        if (def.type === "text" && def.key === "supplierDescription" && st.numericRatio > 0.9) adj = Math.min(adj, 0.55);
        if (def.type === "hs" && st.hsRatio < 0.3) adj = Math.min(adj, 0.55);
      }
      const c: Candidate = { col, field: def.key, score: adj, source: "header" };
      list.push(c);
      candidates.push(c);
    }
    perFieldCandidates.set(def.key, list);
  }

  const requiredKeys = new Set(
    defs.filter((d) => d.required || d.requiredGroup).map((d) => d.key),
  );
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      Number(requiredKeys.has(b.field)) - Number(requiredKeys.has(a.field)) ||
      a.col - b.col,
  );

  const assigned = new Map<string, number>(); // field -> col
  const assignedScore = new Map<string, { score: number; source: "header" | "content" }>();
  const usedCols = new Set<number>();
  for (const c of candidates) {
    if (assigned.has(c.field) || usedCols.has(c.col)) continue;
    assigned.set(c.field, c.col);
    assignedScore.set(c.field, { score: c.score, source: "header" });
    usedCols.add(c.col);
  }

  // 2) content-based fallback for fields still unmapped
  const unmappedFields = (key: string) => !assigned.has(key);
  const freeCols = () =>
    headers.map((_, i) => i).filter((i) => !usedCols.has(i) && stats[i].nonEmpty > 0);
  const assignContent = (field: string, col: number, score: number) => {
    assigned.set(field, col);
    assignedScore.set(field, { score, source: "content" });
    usedCols.add(col);
  };
  const has = (key: string) => defs.some((d) => d.key === key);

  if (has("hsCode") && unmappedFields("hsCode")) {
    const col = freeCols()
      .filter((i) => stats[i].hsRatio >= 0.7 && stats[i].nonEmpty >= 2)
      .sort((a, b) => stats[b].hsRatio - stats[a].hsRatio || a - b)[0];
    if (col !== undefined) assignContent("hsCode", col, 0.65);
  }

  if (has("unitOfMeasure") && unmappedFields("unitOfMeasure")) {
    const col = freeCols()
      .filter((i) => stats[i].unitRatio >= 0.8 && stats[i].nonEmpty >= 2)
      .sort((a, b) => stats[b].unitRatio - stats[a].unitRatio || a - b)[0];
    if (col !== undefined) assignContent("unitOfMeasure", col, 0.65);
  }

  if (has("supplierDescription") && unmappedFields("supplierDescription")) {
    const col = freeCols()
      .filter((i) => stats[i].textRatio >= 0.8 && stats[i].avgLen >= 8)
      .sort((a, b) => stats[b].avgLen - stats[a].avgLen || a - b)[0];
    if (col !== undefined) assignContent("supplierDescription", col, 0.5);
  }

  if (has("lineNumber") && unmappedFields("lineNumber")) {
    const col = freeCols().find(
      (i) => stats[i].sequential && stats[i].intRatio >= 0.95 && i <= 1,
    );
    if (col !== undefined) assignContent("lineNumber", col, 0.6);
  }

  if (kind === "invoice") {
    const needs = ["quantity", "unitPrice", "lineTotalAmount"].some(unmappedFields);
    if (needs) {
      const triple = detectArithmeticTriple(stats, assigned, usedCols);
      if (triple) {
        const roles: Array<[string, number | undefined]> = [
          ["quantity", triple.quantity],
          ["unitPrice", triple.unitPrice],
          ["lineTotalAmount", triple.lineTotalAmount],
        ];
        for (const [field, col] of roles) {
          if (col !== undefined && unmappedFields(field) && !usedCols.has(col)) {
            assignContent(field, col, 0.72);
          }
        }
      }
    }
  }
  if (unmappedFields("quantity") && defs.some((d) => d.key === "quantity")) {
    const col = freeCols()
      .filter((i) => stats[i].numericRatio >= 0.9 && stats[i].intRatio >= 0.9 && !stats[i].sequential)
      .sort((a, b) => a - b)[0];
    if (col !== undefined) assignContent("quantity", col, 0.4);
  }

  // 3) build suggestions (+ ambiguity, alternatives)
  const suggestions: Record<string, FieldSuggestion> = {};
  for (const def of defs) {
    const col = assigned.get(def.key);
    if (col === undefined) {
      suggestions[def.key] = emptySuggestion(def.key);
      continue;
    }
    const info = assignedScore.get(def.key)!;
    const rivals = (perFieldCandidates.get(def.key) ?? [])
      .filter((c) => c.col !== col && c.score >= 0.6)
      .sort((a, b) => b.score - a.score);
    const ambiguous =
      info.source === "header" &&
      rivals.some((r) => Math.abs(r.score - info.score) < 0.001);
    let confidence = confidenceFromScore(info.score);
    if (ambiguous && confidence === "high") confidence = "medium";
    suggestions[def.key] = {
      fieldKey: def.key,
      columnIndex: col,
      confidence,
      score: info.score,
      source: info.source,
      ambiguous,
      alternatives: (perFieldCandidates.get(def.key) ?? [])
        .filter((c) => c.col !== col && c.score >= 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((c) => ({ columnIndex: c.col, score: c.score })),
    };
  }

  const analysis: MappingAnalysis = {
    kind,
    suggestions,
    sure: false,
    reasons: [],
    warnings: [],
    unmappedColumns: headers
      .map((_, i) => i)
      .filter((i) => !usedCols.has(i) && stats[i].nonEmpty > 0),
  };
  decideSure(analysis, defs, headers, norms);
  return analysis;
}

function fieldLabel(defs: FieldDef[], key: string): string {
  return defs.find((d) => d.key === key)?.label ?? key;
}

/** Applies the sure / unsure rules. Mutates analysis.sure / reasons / warnings. */
function decideSure(
  analysis: MappingAnalysis,
  defs: FieldDef[],
  headers: string[],
  norms: string[],
) {
  const { suggestions, kind } = analysis;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const mapped = (key: string) => suggestions[key]?.columnIndex !== null && suggestions[key]?.columnIndex !== undefined;
  const label = (key: string) => fieldLabel(defs, key);

  const checkConfidence = (key: string) => {
    const s = suggestions[key];
    if (!s || s.columnIndex === null) return;
    const col = `"${cleanHeaderLabel(headers[s.columnIndex])}"`;
    if (s.ambiguous) {
      reasons.push(`Several columns look like ${label(key)} - please pick one (using ${col}).`);
    } else if (s.confidence !== "high") {
      reasons.push(`${label(key)} was matched to ${col} with ${s.confidence} confidence.`);
    }
  };

  for (const def of defs) {
    if (def.required) {
      if (!mapped(def.key)) reasons.push(`${def.label} column not found.`);
      else checkConfidence(def.key);
    }
  }

  const groups = new Map<string, FieldDef[]>();
  for (const def of defs) {
    if (def.requiredGroup) {
      groups.set(def.requiredGroup, [...(groups.get(def.requiredGroup) ?? []), def]);
    }
  }
  for (const members of groups.values()) {
    const present = members.filter((m) => mapped(m.key));
    if (present.length === 0) {
      reasons.push(`No ${members.map((m) => m.label.toLowerCase()).join(" or ")} column found.`);
    } else {
      for (const m of present) checkConfidence(m.key);
    }
  }

  if (kind === "invoice") {
    if (mapped("quantity") && mapped("unitPrice") && !mapped("lineTotalAmount")) {
      warnings.push("No total/amount column - line totals will be calculated as quantity x unit price.");
    }
    if (mapped("quantity") && mapped("lineTotalAmount") && !mapped("unitPrice")) {
      warnings.push("No unit price column - lines will be imported without a unit price.");
    }
    if (!mapped("unitOfMeasure")) {
      warnings.push('No unit column - "PCS" will be used as the unit.');
    }
  } else {
    const hasWeight = mapped("netWeightKg") || mapped("grossWeightKg");
    const hasPackages = mapped("numberOfPackages") || mapped("piecesPerPackage");
    if (!hasWeight && !hasPackages) {
      const priceLike = norms.some((n) => headerScore(n, F_UNIT_PRICE) >= 0.88);
      const totalLike = norms.some((n) => headerScore(n, F_TOTAL) >= 0.88);
      reasons.push(
        priceLike && totalLike
          ? "This file has unit price and amount columns but no weight or package columns - it looks like an invoice, not a packing list. Check you uploaded the right file."
          : "No weight or package columns (gross weight, net weight, cartons) were found. Check this is a packing list, or map the columns manually.",
      );
    } else {
      if (!hasWeight) warnings.push("No gross/net weight column found - weights will be empty.");
      if (!hasPackages) warnings.push("No package/carton column found - package counts will be empty.");
    }
    if (!mapped("unitOfMeasure")) {
      warnings.push('No unit column - "PCS" will be used as the unit.');
    }
  }

  analysis.reasons = reasons;
  analysis.warnings = warnings;
  analysis.sure = reasons.length === 0;
}

// ---------------------------------------------------------------------------
// Mapping <-> suggestions <-> saved mapping
// ---------------------------------------------------------------------------

export function mappingFromAnalysis(
  analysis: MappingAnalysis,
  headers: string[],
): ColumnMapping {
  const fields: Record<string, number | null> = {};
  const used = new Set<number>();
  for (const [key, s] of Object.entries(analysis.suggestions)) {
    fields[key] = s.columnIndex;
    if (s.columnIndex !== null) used.add(s.columnIndex);
  }
  const extraColumns: Record<string, "extra" | "ignore"> = {};
  headers.forEach((_, i) => {
    if (!used.has(i)) extraColumns[String(i)] = "extra";
  });
  return { fields, extraColumns };
}

export function mappingToSaved(mapping: ColumnMapping, headers: string[]): SavedColumnMapping {
  const keys = headerKeys(headers);
  const fields: Record<string, string | null> = {};
  for (const [field, idx] of Object.entries(mapping.fields)) {
    fields[field] = idx === null || idx === undefined ? null : keys[idx] ?? null;
  }
  const extraColumns: Record<string, "extra" | "ignore"> = {};
  for (const [idx, mode] of Object.entries(mapping.extraColumns ?? {})) {
    const k = keys[Number(idx)];
    if (k) extraColumns[k] = mode;
  }
  return { fields, extraColumns };
}

/** Returns null when the saved mapping no longer fits these headers. */
export function savedToMapping(saved: SavedColumnMapping, headers: string[]): ColumnMapping | null {
  const keys = headerKeys(headers);
  const fields: Record<string, number | null> = {};
  for (const [field, key] of Object.entries(saved.fields ?? {})) {
    if (key === null || key === undefined) {
      fields[field] = null;
      continue;
    }
    const idx = keys.indexOf(key);
    if (idx < 0) return null;
    fields[field] = idx;
  }
  const extraColumns: Record<string, "extra" | "ignore"> = {};
  for (const [key, mode] of Object.entries(saved.extraColumns ?? {})) {
    const idx = keys.indexOf(key);
    if (idx >= 0) extraColumns[String(idx)] = mode;
  }
  return { fields, extraColumns };
}

/** Validation of a (user) mapping: returns human-readable problems. */
export function validateMapping(
  kind: MappingDocKind,
  mapping: ColumnMapping,
  columnCount: number,
): string[] {
  const defs = FIELD_DEFS[kind];
  const problems: string[] = [];
  const seen = new Map<number, string>();
  for (const def of defs) {
    const idx = mapping.fields[def.key];
    if (idx === null || idx === undefined) continue;
    if (idx < 0 || idx >= columnCount) {
      problems.push(`${def.label}: column ${idx + 1} does not exist.`);
      continue;
    }
    const prev = seen.get(idx);
    if (prev) problems.push(`One column cannot be used for both ${prev} and ${def.label}.`);
    else seen.set(idx, def.label);
  }
  for (const def of defs) {
    if (def.required && (mapping.fields[def.key] ?? null) === null) {
      problems.push(`${def.label} must be mapped.`);
    }
  }
  const groups = new Map<string, FieldDef[]>();
  for (const def of defs) {
    if (def.requiredGroup) groups.set(def.requiredGroup, [...(groups.get(def.requiredGroup) ?? []), def]);
  }
  for (const members of groups.values()) {
    if (!members.some((m) => (mapping.fields[m.key] ?? null) !== null)) {
      problems.push(`Map at least one of: ${members.map((m) => m.label).join(" / ")}.`);
    }
  }
  return problems;
}
