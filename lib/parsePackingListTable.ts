import { parseLines, type ParsedLine } from "./parseLines";
import {
  countHsCodesInText,
  extractHsFromLine,
  normalizeHsCode,
  preprocessPackingListOcr,
} from "./hsCodeUtils";
import {
  cleanProductDescription,
  extractPackingListQuantity,
  isNonItemLine,
  isValidProductDescription,
  normalizeLineQuantity,
  rejectModelSuffixQuantity,
} from "./packingListFilters";
import { isPlausibleHsCode } from "./hsCodeUtils";

export type ClassificationMode = "ai" | "pre_coded";

export type ParsedPackingRow = ParsedLine & {
  lineNumber: number | null;
  sourceHsCode: string | null;
  specification: string | null;
};

const HEADER_NOISE =
  /^(no\.?|description|hs\s*code|specification|qty|quantity|unit|gw|nw|measure|total|subtotal|packing\s*list)/i;

const UNIT_PATTERN =
  /\b(CTNS?|CARTONS?|PCS?|PC|PIECES?|SETS?|SET|UNITS?|BOX(?:ES)?|ROLLS?|KG|KGS?)\s*$/i;

const HS_IN_LINE = /\b\d{4}\.\d{2,4}\b/g;

function isHeaderLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 3) return true;
  if (HEADER_NOISE.test(t)) return true;
  if (/^description\s+of\s+goods/i.test(t)) return true;
  return false;
}

/** OCR often puts `PCS 1 15 0,15` on the line after the product description. */
function attachQuantityTailLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (
      /^(?:PCS?|Pcs|SETS?|ROLLS?|SQM)\s+\d/i.test(t) &&
      out.length > 0
    ) {
      out[out.length - 1] = `${out[out.length - 1]} ${t}`;
      continue;
    }
    out.push(t);
  }
  return out;
}

function resolveParsedQuantity(
  rawLine: string,
  parsedQuantity: number | null,
): number | null {
  const packed = extractPackingListQuantity(rawLine);
  const candidate = packed?.quantity ?? parsedQuantity;
  return rejectModelSuffixQuantity(rawLine, normalizeLineQuantity(candidate));
}

/** OCR often splits one table row across several lines — merge until an HS code appears. */
function mergeMultilineTableRows(lines: string[]): string[] {
  const merged: string[] = [];
  const buf: string[] = [];

  const flush = (withLine?: string) => {
    const parts = withLine ? [...buf, withLine] : [...buf];
    const text = parts.join(" ").replace(/\s+/g, " ").trim();
    buf.length = 0;
    if (text.length > 4) merged.push(text);
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      flush();
      continue;
    }
    if (extractHsFromLine(t)) {
      flush(t);
      continue;
    }
    if (/^\d{1,3}$/.test(t) || (buf.length > 0 && buf.length < 6)) {
      buf.push(t);
      continue;
    }
    flush();
    merged.push(t);
  }
  flush();
  return merged;
}

/** OCR often merges multiple table rows into one line — split on each HS code. */
function expandLinesForTableParse(lines: string[]): string[] {
  const expanded: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const matches = [...trimmed.matchAll(HS_IN_LINE)];
    if (matches.length <= 1) {
      expanded.push(trimmed);
      continue;
    }
    for (let i = 0; i < matches.length; i++) {
      const start =
        i === 0 ? 0 : (matches[i - 1].index ?? 0 + matches[i - 1][0].length);
      const end =
        i < matches.length - 1
          ? (matches[i + 1].index ?? trimmed.length)
          : trimmed.length;
      const chunk = trimmed.slice(start, end).trim();
      if (chunk.length > 8) expanded.push(chunk);
    }
  }
  return expanded;
}

function parseTableLine(
  line: string,
  lineIndex: number,
): ParsedPackingRow | null {
  const raw = line.trim();
  if (!raw || isHeaderLine(raw)) return null;

  const sourceHsCode = extractHsFromLine(raw);
  if (
    !sourceHsCode ||
    !normalizeHsCode(sourceHsCode) ||
    !isPlausibleHsCode(sourceHsCode)
  ) {
    return null;
  }

  const hsMatch = raw.match(/\b\d{4}\.\d{2,4}\b/);
  if (!hsMatch || hsMatch.index === undefined) return null;

  const before = raw.slice(0, hsMatch.index).trim();
  const after = raw.slice(hsMatch.index + hsMatch[0].length).trim();

  let lineNumber: number | null = null;
  let description = before;

  const noMatch = before.match(/^(\d{1,3})\s+(.+)$/);
  if (noMatch) {
    const n = Number.parseInt(noMatch[1], 10);
    if (n >= 1 && n <= 999) lineNumber = n;
    description = cleanProductDescription(noMatch[2]);
  } else {
    description = cleanProductDescription(description);
  }

  if (!isValidProductDescription(description)) return null;
  if (isNonItemLine(description, raw)) return null;

  let specification: string | null = null;
  let quantity: number | null = null;
  let unit: string | null = null;

  if (after) {
    const unitMatch = after.match(UNIT_PATTERN);
    if (unitMatch && unitMatch.index !== undefined) {
      unit = unitMatch[1].toUpperCase();
      if (unit === "CTN") unit = "CTNS";
      const beforeUnit = after.slice(0, unitMatch.index).trim();
      const qtyMatch = beforeUnit.match(/(\d{1,4}(?:\.\d+)?)\s*$/);
      if (qtyMatch && qtyMatch.index !== undefined) {
        quantity = normalizeLineQuantity(Number.parseFloat(qtyMatch[1]));
        specification = beforeUnit.slice(0, qtyMatch.index).trim() || null;
      } else {
        specification = beforeUnit || null;
      }
    } else {
      specification = after;
    }
  }

  return {
    rawLine: raw,
    description,
    quantity: quantity ?? 1,
    unit: unit ?? "CTNS",
    lineIndex,
    lineNumber,
    sourceHsCode,
    specification,
  };
}

function dedupeRows(rows: ParsedPackingRow[]): ParsedPackingRow[] {
  const seen = new Set<string>();
  const out: ParsedPackingRow[] = [];
  for (const row of rows) {
    const key = [
      row.lineNumber ?? "",
      row.sourceHsCode ?? "",
      row.description.slice(0, 80),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function parseAllTableRows(expanded: string[]): ParsedPackingRow[] {
  const tableRows: ParsedPackingRow[] = [];
  for (let i = 0; i < expanded.length; i++) {
    const row = parseTableLine(expanded[i], i);
    if (row) tableRows.push(row);
  }
  return dedupeRows(tableRows);
}

export function detectClassificationMode(
  rows: ParsedPackingRow[],
  hsCodesInDocument?: number,
): ClassificationMode {
  if (hsCodesInDocument !== undefined && hsCodesInDocument >= 5) {
    return "pre_coded";
  }
  if (rows.length < 3) return "ai";
  const withHs = rows.filter((r) => r.sourceHsCode).length;
  return withHs / rows.length >= 0.8 ? "pre_coded" : "ai";
}

/**
 * Parse extracted document text. Prefer structured table rows with HS codes.
 * Never fall back to line-by-line AI parsing when the document contains an HS column.
 */
export function parsePackingListFromText(extractedText: string): {
  rows: ParsedPackingRow[];
  mode: ClassificationMode;
} {
  const preprocessed = preprocessPackingListOcr(extractedText);
  const hsCodesInDocument = countHsCodesInText(preprocessed);

  const lines = attachQuantityTailLines(
    preprocessed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 2),
  );

  const merged = mergeMultilineTableRows(lines);
  const expanded = expandLinesForTableParse(merged);
  const deduped = parseAllTableRows(expanded);

  if (deduped.length >= 3) {
    return {
      rows: deduped,
      mode: detectClassificationMode(deduped, hsCodesInDocument),
    };
  }

  if (hsCodesInDocument >= 5) {
    if (deduped.length >= 1) {
      return { rows: deduped, mode: "pre_coded" };
    }
    return { rows: [], mode: "pre_coded" };
  }

  if (hsCodesInDocument >= 3 && deduped.length >= 1) {
    return { rows: deduped, mode: "pre_coded" };
  }

  const plain = parseLines(preprocessed);
  const aiRows: ParsedPackingRow[] = [];
  for (const p of plain) {
    if (isNonItemLine(p.description, p.rawLine)) continue;
    if (!isValidProductDescription(p.description)) continue;
    const qty = resolveParsedQuantity(p.rawLine, p.quantity);
    aiRows.push({
      ...p,
      quantity: qty ?? 1,
      unit: extractPackingListQuantity(p.rawLine)?.unit ?? p.unit,
      lineNumber: null,
      sourceHsCode: null,
      specification: null,
    });
  }

  return {
    rows: aiRows,
    mode: "ai",
  };
}
