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

function parseSheetRows(
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

export function parseHsTariffBookBuffer(buffer: Buffer): ImportTariffBookResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const errors: string[] = [];
  const allRows: ParsedTariffRow[] = [];
  let skipped = 0;

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
  };
}
