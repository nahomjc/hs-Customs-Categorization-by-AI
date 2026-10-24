/**
 * Robust spreadsheet reading for invoice / packing-list uploads.
 *
 * - skips empty sheets
 * - finds the header row automatically (it is not always row 1)
 * - skips blank, total and footer rows
 * - keeps every cell as string | number | null (numbers stored as text are
 *   parsed later, see column-mapping.parseNumber)
 */
import * as XLSX from "xlsx";
import {
  cleanHeaderLabel,
  headerRowScore,
  type Cell,
  type MappingDocKind,
} from "./column-mapping";

export type SheetTable = {
  sheetName: string;
  /** 0-based index of the header row inside the sheet's used range. */
  headerRowIndex: number;
  /** 1-based spreadsheet row number of the header row. */
  headerRowNumber: number;
  headers: string[];
  rows: Cell[][];
  /** 1-based spreadsheet row number for every entry of `rows`. */
  rowNumbers: number[];
  /** Cells above the header row (invoice no., supplier, ... live here). */
  metaRows: Cell[][];
  skipped: { blank: number; total: number; note: number };
};

export type SheetSummary = {
  name: string;
  rowCount: number;
  usable: boolean;
};

export type SpreadsheetRead = {
  sheets: SheetSummary[];
  table: SheetTable | null;
  /** Set when no table could be read, explains why. */
  error?: string;
};

export type ReadOptions = {
  kind?: MappingDocKind;
  sheetName?: string;
  /** 1-based header row override (from the UI). */
  headerRow?: number;
};

const MAX_HEADER_SCAN = 30;
const TOTAL_ROW =
  /^(grand\s*)?(sub[\s-]?)?total(\s*(amount|value|qty|quantity|usd|cny|eur|etb))?\s*[:\uff1a]?$|^sum$|^tot\.?$|^\u5408\u8ba1$|^\u603b\u8ba1$/i;

function normalizeCell(value: unknown): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  const s = String(value).replace(/\u00a0/g, " ").trim();
  return s === "" ? null : s;
}

function isBlankRow(row: Cell[]): boolean {
  return row.every((c) => c === null);
}

function nonEmptyCount(row: Cell[]): number {
  return row.reduce<number>((n, c) => (c === null ? n : n + 1), 0);
}

function textRatio(row: Cell[]): number {
  const filled = row.filter((c) => c !== null);
  if (filled.length === 0) return 0;
  return filled.filter((c) => typeof c === "string" && Number.isNaN(Number(c))).length / filled.length;
}

type RawSheet = { name: string; rows: Cell[][]; rowOffset: number };

function loadSheets(buffer: Buffer): RawSheet[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const out: RawSheet[] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet || !sheet["!ref"]) continue;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: true,
    });
    const rows = raw.map((r) => (Array.isArray(r) ? r.map(normalizeCell) : [normalizeCell(r)]));
    if (!rows.some((r) => !isBlankRow(r))) continue;
    out.push({ name, rows, rowOffset: range.s.r });
  }
  return out;
}

function pickHeaderRow(rows: Cell[][], kind?: MappingDocKind): { index: number; score: number } | null {
  let best: { index: number; score: number } | null = null;
  const limit = Math.min(rows.length - 1, MAX_HEADER_SCAN);
  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    const filled = nonEmptyCount(row);
    if (filled < 2 || textRatio(row) < 0.6) continue;
    // a header row must be followed by at least one non-blank row
    const hasData = rows.slice(i + 1, i + 6).some((r) => nonEmptyCount(r) >= 2);
    if (!hasData) continue;
    const score = headerRowScore(row, kind);
    if (score <= 0) continue;
    const weighted = score + filled * 0.02;
    if (!best || weighted > best.score + 0.001) best = { index: i, score: weighted };
  }
  if (best) return best;
  // fallback: first row that looks like a header (>=3 text cells) followed by data
  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    if (nonEmptyCount(row) >= 3 && textRatio(row) >= 0.8) {
      const next = rows[i + 1];
      if (next && nonEmptyCount(next) >= 2) return { index: i, score: 0 };
    }
  }
  return null;
}

function columnLetter(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function buildTable(sheet: RawSheet, headerIndex: number): SheetTable {
  const headerCells = sheet.rows[headerIndex];
  let width = headerCells.length;
  while (width > 0 && headerCells[width - 1] === null) width--;

  // data may be wider than the header row (extra columns without a title)
  const dataRows = sheet.rows.slice(headerIndex + 1);
  let dataWidth = width;
  for (const r of dataRows.slice(0, 300)) {
    let w = r.length;
    while (w > 0 && r[w - 1] === null) w--;
    if (w > dataWidth) dataWidth = w;
  }
  const headers: string[] = [];
  for (let c = 0; c < dataWidth; c++) {
    const label = cleanHeaderLabel(headerCells[c]);
    headers.push(label || `Column ${columnLetter(c)}`);
  }

  const rows: Cell[][] = [];
  const rowNumbers: number[] = [];
  const skipped = { blank: 0, total: 0, note: 0 };
  dataRows.forEach((r, i) => {
    const padded: Cell[] = [];
    for (let c = 0; c < dataWidth; c++) padded.push(r[c] ?? null);
    if (isBlankRow(padded)) {
      skipped.blank++;
      return;
    }
    const firstText = padded.find((c) => typeof c === "string" && c.trim() !== "") as string | undefined;
    const lead = padded.slice(0, 3).find((c) => typeof c === "string") as string | undefined;
    if ((lead && TOTAL_ROW.test(lead.trim())) || (firstText && TOTAL_ROW.test(firstText.trim()) && nonEmptyCount(padded) <= 6)) {
      skipped.total++;
      return;
    }
    if (nonEmptyCount(padded) <= 1 && typeof firstText === "string" && firstText.length > 25) {
      skipped.note++;
      return;
    }
    rows.push(padded);
    rowNumbers.push(sheet.rowOffset + headerIndex + 1 + i + 1);
  });

  return {
    sheetName: sheet.name,
    headerRowIndex: headerIndex,
    headerRowNumber: sheet.rowOffset + headerIndex + 1,
    headers,
    rows,
    rowNumbers,
    metaRows: sheet.rows.slice(0, headerIndex),
    skipped,
  };
}

export function readSpreadsheetTable(buffer: Buffer, options: ReadOptions = {}): SpreadsheetRead {
  let sheets: RawSheet[];
  try {
    sheets = loadSheets(buffer);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { sheets: [], table: null, error: `The spreadsheet could not be opened: ${msg}` };
  }
  if (sheets.length === 0) {
    return { sheets: [], table: null, error: "The spreadsheet has no data (all sheets are empty)." };
  }

  type Scored = { sheet: RawSheet; header: { index: number; score: number } | null; dataRows: number };
  const scored: Scored[] = sheets.map((sheet) => {
    const header = pickHeaderRow(sheet.rows, options.kind);
    const dataRows = header ? sheet.rows.length - header.index - 1 : 0;
    return { sheet, header, dataRows };
  });

  const summaries: SheetSummary[] = scored.map((s) => ({
    name: s.sheet.name,
    rowCount: s.dataRows,
    usable: s.header !== null && s.dataRows > 0,
  }));

  let chosen: Scored | undefined;
  if (options.sheetName) {
    chosen = scored.find((s) => s.sheet.name === options.sheetName);
    if (!chosen) {
      return { sheets: summaries, table: null, error: `Sheet "${options.sheetName}" was not found.` };
    }
  } else {
    chosen = scored
      .filter((s) => s.header && s.dataRows > 0)
      .sort(
        (a, b) =>
          (b.header!.score + Math.min(b.dataRows, 500) * 0.01) -
          (a.header!.score + Math.min(a.dataRows, 500) * 0.01),
      )[0];
  }
  if (!chosen) {
    return {
      sheets: summaries,
      table: null,
      error: "No header row with data rows below it was found in this spreadsheet.",
    };
  }

  let headerIndex = chosen.header?.index ?? 0;
  if (options.headerRow !== undefined) {
    headerIndex = options.headerRow - 1 - chosen.sheet.rowOffset;
    if (headerIndex < 0 || headerIndex >= chosen.sheet.rows.length - 1) {
      return { sheets: summaries, table: null, error: `Header row ${options.headerRow} is outside the sheet.` };
    }
  } else if (!chosen.header) {
    return { sheets: summaries, table: null, error: "No header row was found on this sheet." };
  }

  const table = buildTable(chosen.sheet, headerIndex);
  if (table.rows.length === 0) {
    return { sheets: summaries, table, error: "The header row was found but there are no data rows below it." };
  }
  return { sheets: summaries, table };
}
