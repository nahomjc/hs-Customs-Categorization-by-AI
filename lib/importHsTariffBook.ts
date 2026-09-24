import * as XLSX from "xlsx";
import { normalizeHsCode } from "./hsCodeUtils";

export type ParsedTariffRow = {
  heading: string | null;
  hsCode: string | null;
  tariffNo: string;
  description: string;
  stdUnit: string | null;
  dutyRate: string | null;
  chapter: string | null;
  normalizedHs: string | null;
};

export type ImportTariffBookResult = {
  rows: ParsedTariffRow[];
  skipped: number;
  errors: string[];
  sheetCount: number;
  /** Detected source layout for UI/logging. */
  format?: "ecc_book" | "esw_list" | "unknown";
};

function cellValue(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  return String(cell).trim();
}

function isTariffNumber(value: string): boolean {
  return /^\d/.test(value);
}

function normalizeTariffNo(raw: unknown): string | null {
  const s = cellValue(raw).replace(/\s/g, "");
  if (!s || !isTariffNumber(s)) return null;
  return s;
}

/** Derive HS from Ethiopian tariff number when H.S. column is empty. */
export function tariffNoToHs(tariffNo: string): string | null {
  const direct = normalizeHsCode(tariffNo);
  if (direct) return direct.display;

  const dotted = tariffNo.match(/^(\d+)\.(\d+)$/);
  if (!dotted) return null;

  const headPart = dotted[1];
  const subPart = dotted[2];

  if (headPart.length === 3) {
    const heading = `0${headPart.slice(0, 1)}${headPart.slice(1)}`;
    const n = normalizeHsCode(`${heading}.${subPart}`);
    return n?.display ?? null;
  }

  if (headPart.length >= 4) {
    const n = normalizeHsCode(`${headPart}.${subPart}`);
    return n?.display ?? null;
  }

  return null;
}

function normalizeHeading(raw: unknown): string | null {
  const s = cellValue(raw);
  if (!s) return null;
  const m = s.match(/^(\d{1,2}\.\d{1,2})/);
  return m ? m[1] : null;
}

function headingFromNormalizedHs(normalizedHs: string | null): string | null {
  if (!normalizedHs) return null;
  const digits = normalizedHs.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}`;
}

/** Format ESW numeric DR (e.g. 35.0) as a duty display string. */
function formatEswDutyRate(raw: unknown): string | null {
  const s = cellValue(raw);
  if (!s) return null;
  if (/%/i.test(s) || /free/i.test(s)) return s;
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (n === 0) return "0%";
  // Keep one decimal only when needed (35.0 → 35%, 12.5 → 12.5%)
  const text = Number.isInteger(n) ? String(n) : String(n);
  return `${text}%`;
}

type SheetFormat = "ecc_book" | "esw_list" | "unknown";

/**
 * Detect sheet layout from the header / first data-looking row.
 * - ECC combined book: Heading | H.S. | Tariff No | Description | Unit | Duty
 * - ESW tariff list: No | HS Code | HS Description | Unit(s) | DR | ER | VAT | …
 */
export function detectTariffSheetFormat(
  sheetRows: unknown[][],
): SheetFormat {
  for (let i = 0; i < Math.min(5, sheetRows.length); i++) {
    const row = sheetRows[i];
    if (!row) continue;
    const cells = row.map((c) => cellValue(c).toLowerCase());
    const joined = cells.join("|");

    if (
      (joined.includes("hs code") && joined.includes("hs description")) ||
      (joined.includes("hs code") && joined.includes("dr"))
    ) {
      return "esw_list";
    }

    if (
      cells[0] === "heading" ||
      (joined.includes("tariff") && joined.includes("description"))
    ) {
      return "ecc_book";
    }
  }

  // Heuristic: first data row looks like ESW (seq, 8-digit HS, description text)
  for (let i = 0; i < Math.min(8, sheetRows.length); i++) {
    const row = sheetRows[i];
    if (!row) continue;
    const a = cellValue(row[0]);
    const b = cellValue(row[1]).replace(/\s/g, "");
    const c = cellValue(row[2]);
    if (/^\d+$/.test(a) && /^\d{6,10}$/.test(b) && c.length > 2 && !/^\d/.test(c)) {
      return "esw_list";
    }
  }

  return "unknown";
}

function parseEccSheetRows(
  sheetRows: unknown[][],
  errors: string[],
): { rows: ParsedTariffRow[]; skipped: number } {
  const rows: ParsedTariffRow[] = [];
  let skipped = 0;
  let currentHeading: string | null = null;

  for (let i = 0; i < sheetRows.length; i++) {
    const row = sheetRows[i];
    if (!row || row.length === 0) continue;

    const colA = cellValue(row[0]);
    const colB = cellValue(row[1]);
    const colC = row[2];
    const colD = cellValue(row[3]);
    const colE = cellValue(row[4]);
    const colF = cellValue(row[5]);

    if (colA === "Heading") continue;
    if (colA === "-1" || colB === "Code (2)") continue;

    const headingFromA = normalizeHeading(colA);
    if (headingFromA) {
      currentHeading = headingFromA;
    }

    const tariffNo = normalizeTariffNo(colC);
    if (!tariffNo) {
      if (colD || colB) skipped++;
      continue;
    }

    if (!colD) {
      skipped++;
      errors.push(`Row ${i + 1}: tariff ${tariffNo} missing description`);
      continue;
    }

    let normalizedHs: string | null = null;
    let hsCode: string | null = null;

    if (colB) {
      const n = normalizeHsCode(colB);
      if (n) {
        normalizedHs = n.display;
        hsCode = n.display;
      } else {
        hsCode = colB;
      }
    }

    if (!normalizedHs) {
      normalizedHs = tariffNoToHs(tariffNo);
      if (!hsCode && normalizedHs) hsCode = normalizedHs;
    }

    const chapter =
      normalizedHs?.slice(0, 2) ??
      (tariffNo.length >= 2 ? tariffNo.slice(0, 2).padStart(2, "0") : null);

    rows.push({
      heading: currentHeading,
      hsCode,
      tariffNo,
      description: colD,
      stdUnit: colE || null,
      dutyRate: colF || null,
      chapter,
      normalizedHs,
    });
  }

  return { rows, skipped };
}

/**
 * Ethiopian Electronic Single Window export:
 * No | HS Code | HS Description | Unit(s) | DR | ER | VAT | SR | WHT
 * Chapter is derived from the first 2 digits of HS Code (no chapter column needed).
 */
function parseEswSheetRows(
  sheetRows: unknown[][],
  errors: string[],
): { rows: ParsedTariffRow[]; skipped: number } {
  const rows: ParsedTariffRow[] = [];
  let skipped = 0;

  for (let i = 0; i < sheetRows.length; i++) {
    const row = sheetRows[i];
    if (!row || row.length === 0) continue;

    const colA = cellValue(row[0]);
    const colB = cellValue(row[1]);
    const colC = cellValue(row[2]);
    const colD = cellValue(row[3]);
    const colE = row[4];

    // Skip header
    if (
      colA.toLowerCase() === "no" ||
      colB.toLowerCase() === "hs code" ||
      colC.toLowerCase() === "hs description"
    ) {
      continue;
    }

    const hsRaw = colB.replace(/\s/g, "");
    if (!hsRaw || !/^\d{4,10}$/.test(hsRaw)) {
      if (colC) skipped++;
      continue;
    }

    if (!colC) {
      skipped++;
      errors.push(`Row ${i + 1}: HS ${hsRaw} missing description`);
      continue;
    }

    const normalized = normalizeHsCode(hsRaw);
    const normalizedHs = normalized?.display ?? null;
    const chapter =
      normalized?.chapter ??
      (hsRaw.length >= 2 ? hsRaw.slice(0, 2).padStart(2, "0") : null);
    const heading =
      headingFromNormalizedHs(normalizedHs) ??
      (hsRaw.length >= 4
        ? `${hsRaw.slice(0, 2)}.${hsRaw.slice(2, 4)}`
        : null);

    rows.push({
      heading,
      hsCode: normalizedHs ?? hsRaw,
      // Prefer 8-digit national code as stable unique key (matches ESW).
      tariffNo: hsRaw,
      description: colC,
      stdUnit: colD || null,
      dutyRate: formatEswDutyRate(colE),
      chapter,
      normalizedHs,
    });
  }

  return { rows, skipped };
}

function parseSheetRows(
  sheetRows: unknown[][],
  errors: string[],
): { rows: ParsedTariffRow[]; skipped: number; format: SheetFormat } {
  const format = detectTariffSheetFormat(sheetRows);

  if (format === "esw_list") {
    const parsed = parseEswSheetRows(sheetRows, errors);
    return { ...parsed, format };
  }

  // Default: ECC combined tariff book (also used when format is unknown)
  const parsed = parseEccSheetRows(sheetRows, errors);
  return { ...parsed, format: format === "unknown" ? "ecc_book" : format };
}

export function parseHsTariffBookBuffer(buffer: Buffer): ImportTariffBookResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const errors: string[] = [];
  const allRows: ParsedTariffRow[] = [];
  let skipped = 0;
  let detectedFormat: SheetFormat = "unknown";

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
    });

    const parsed = parseSheetRows(sheetRows, errors);
    allRows.push(...parsed.rows);
    skipped += parsed.skipped;
    if (parsed.format !== "unknown") {
      detectedFormat = parsed.format;
    }
  }

  const byTariff = new Map<string, ParsedTariffRow>();
  for (const row of allRows) {
    byTariff.set(row.tariffNo, row);
  }

  return {
    rows: [...byTariff.values()],
    skipped,
    errors: errors.slice(0, 20),
    sheetCount: workbook.SheetNames.length,
    format: detectedFormat,
  };
}
