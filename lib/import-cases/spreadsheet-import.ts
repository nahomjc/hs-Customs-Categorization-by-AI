/**
 * Turns a mapped spreadsheet table into invoice / packing-list extraction results
 * (same shape the AI extraction produces) without calling the AI.
 *
 * Every problem is reported with the spreadsheet row, the column header and the
 * field, so the UI can say exactly what is wrong.
 */
import { normalizeHsCode } from "@/lib/hsCodeUtils";
import {
  cellText,
  cleanHeaderLabel,
  detectCurrencyInHeader,
  getFieldDefs,
  hsDigits,
  normalizeUnit,
  parseNumber,
  roundDecimal,
  type Cell,
  type ColumnMapping,
  type FieldDef,
  type MappingDocKind,
} from "./column-mapping";
import type { SheetTable } from "./spreadsheet-reader";
import type {
  InvoiceExtractResult,
  PackingListExtractResult,
} from "./extraction-schemas";

export type ImportIssue = {
  /** 1-based spreadsheet row number. */
  row?: number;
  /** Column header as written in the file. */
  column?: string;
  field?: string;
  message: string;
};

export type SpreadsheetBuildReport = {
  issues: ImportIssue[];
  warnings: string[];
  rowsRead: number;
  rowsImported: number;
  rowsSkipped: number;
  extraColumns: string[];
};

/** Thrown when nothing usable could be imported; message is user-facing. */
export class SpreadsheetImportError extends Error {
  issues: ImportIssue[];
  constructor(message: string, issues: ImportIssue[] = []) {
    super(message);
    this.name = "SpreadsheetImportError";
    this.issues = issues;
  }
}

const MAX_ISSUES = 25;
const MAX_EXTRA_LEN = 500;

const COUNTRY_NAMES: Record<string, string> = {
  china: "CN", "p r china": "CN", prc: "CN", india: "IN", turkey: "TR", turkiye: "TR",
  "united arab emirates": "AE", uae: "AE", germany: "DE", italy: "IT", france: "FR",
  spain: "ES", vietnam: "VN", thailand: "TH", japan: "JP", korea: "KR", "south korea": "KR",
  malaysia: "MY", indonesia: "ID", pakistan: "PK", egypt: "EG", kenya: "KE",
  "united states": "US", usa: "US", "united kingdom": "GB", uk: "GB", brazil: "BR",
  netherlands: "NL", belgium: "BE", poland: "PL", taiwan: "TW", singapore: "SG",
  bangladesh: "BD", ethiopia: "ET", djibouti: "DJ", russia: "RU", ukraine: "UA",
};

function countryCode(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^[A-Za-z]{2,3}$/.test(t)) return t.toUpperCase();
  return COUNTRY_NAMES[t.toLowerCase().replace(/[.,]/g, "")] ?? null;
}

type Ctx = {
  table: SheetTable;
  mapping: ColumnMapping;
  defs: Map<string, FieldDef>;
  issues: ImportIssue[];
  warnings: string[];
  issueCounts: Map<string, number>;
};

function label(ctx: Ctx, key: string): string {
  return ctx.defs.get(key)?.label ?? key;
}

function colOf(ctx: Ctx, key: string): number | null {
  const idx = ctx.mapping.fields[key];
  return idx === null || idx === undefined ? null : idx;
}

function raw(ctx: Ctx, key: string, row: Cell[]): Cell {
  const c = colOf(ctx, key);
  return c === null ? null : row[c] ?? null;
}

function pushIssue(ctx: Ctx, issue: ImportIssue) {
  const key = `${issue.field ?? ""}|${issue.column ?? ""}`;
  ctx.issueCounts.set(key, (ctx.issueCounts.get(key) ?? 0) + 1);
  if (ctx.issues.length < MAX_ISSUES) ctx.issues.push(issue);
}

function numberField(
  ctx: Ctx,
  key: string,
  row: Cell[],
  rowNumber: number,
  dp: number,
  opts: { allowNegative?: boolean } = {},
): { value: string | null; bad: boolean } {
  const cell = raw(ctx, key, row);
  if (cellText(cell) === "") return { value: null, bad: false };
  const n = parseNumber(cell);
  const column = cleanHeaderLabel(ctx.table.headers[colOf(ctx, key)!]);
  if (n === null) {
    pushIssue(ctx, {
      row: rowNumber,
      column,
      field: label(ctx, key),
      message: `Row ${rowNumber}: "${column}" value "${cellText(cell)}" is not a number.`,
    });
    return { value: null, bad: true };
  }
  if (n < 0 && !opts.allowNegative) {
    pushIssue(ctx, {
      row: rowNumber,
      column,
      field: label(ctx, key),
      message: `Row ${rowNumber}: "${column}" value "${cellText(cell)}" is negative.`,
    });
    return { value: null, bad: true };
  }
  return { value: roundDecimal(n, dp), bad: false };
}

function textField(ctx: Ctx, key: string, row: Cell[], max?: number): string | null {
  const t = cellText(raw(ctx, key, row));
  if (!t) return null;
  return max ? t.slice(0, max) : t;
}

function hsValue(ctx: Ctx, row: Cell[]): string | null {
  const cell = raw(ctx, "hsCode", row);
  if (cellText(cell) === "") return null;
  const digits = hsDigits(cell);
  if (!digits) return cellText(cell).slice(0, 40);
  const norm = normalizeHsCode(digits.length >= 6 ? digits : digits);
  return norm?.display ?? digits;
}

function buildExtra(ctx: Ctx, row: Cell[]): Record<string, string> | null {
  const extra: Record<string, string> = {};
  const put = (name: string, value: string | null) => {
    if (!value) return;
    let key = name;
    let n = 2;
    while (key in extra) key = `${name} (${n++})`;
    extra[key] = value.slice(0, MAX_EXTRA_LEN);
  };
  for (const [key, def] of ctx.defs) {
    if (def.storage !== "extra") continue;
    if (colOf(ctx, key) === null) continue;
    if (key === "hsCode") put(def.label, hsValue(ctx, row));
    else put(def.label, textField(ctx, key, row));
  }
  const used = new Set(
    Object.values(ctx.mapping.fields).filter((v): v is number => v !== null && v !== undefined),
  );
  ctx.table.headers.forEach((header, idx) => {
    if (used.has(idx)) return;
    if ((ctx.mapping.extraColumns?.[String(idx)] ?? "extra") === "ignore") return;
    put(cleanHeaderLabel(header), cellText(row[idx]) || null);
  });
  return Object.keys(extra).length > 0 ? extra : null;
}

function extraColumnNames(ctx: Ctx): string[] {
  const used = new Set(
    Object.values(ctx.mapping.fields).filter((v): v is number => v !== null && v !== undefined),
  );
  const names: string[] = [];
  ctx.table.headers.forEach((header, idx) => {
    if (used.has(idx)) return;
    if ((ctx.mapping.extraColumns?.[String(idx)] ?? "extra") === "ignore") return;
    const hasData = ctx.table.rows.some((r) => cellText(r[idx]) !== "");
    if (hasData) names.push(cleanHeaderLabel(header));
  });
  return names;
}

function lineNumbers(ctx: Ctx, rawNumbers: Array<number | null>): number[] {
  const seq = rawNumbers.map((_, i) => i + 1);
  if (colOf(ctx, "lineNumber") === null) return seq;
  const seen = new Set<number>();
  for (const n of rawNumbers) {
    if (n === null || !Number.isInteger(n) || n <= 0 || seen.has(n)) {
      ctx.warnings.push("Line numbers in the file are missing or repeated - lines were numbered 1, 2, 3... instead.");
      return seq;
    }
    seen.add(n);
  }
  return rawNumbers as number[];
}

const SUPPLIER_LABEL =
  /^(?:supplier|seller|exporter|shipper|vendor)(?:\s*name)?\s*(?:[:\uff1a]\s*(.*))?$/i;

// ---- document meta (invoice no., date, supplier) from rows above the header --

function findMeta(metaRows: Cell[][], patterns: RegExp[]): string | null {
  for (const row of metaRows) {
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (typeof cell !== "string") continue;
      const text = cell.replace(/\s+/g, " ").trim();
      for (const re of patterns) {
        const m = text.match(re);
        if (!m) continue;
        const inline = (m[1] ?? "").replace(/^[:\uff1a\s#.-]+/, "").trim();
        if (inline) return inline;
        for (let k = c + 1; k < row.length; k++) {
          const next = cellText(row[k]);
          if (next) return next;
        }
      }
    }
  }
  return null;
}

function excelSerialToIso(n: number): string | null {
  if (n < 20000 || n > 80000) return null;
  const d = new Date(Math.round((n - 25569) * 86400 * 1000));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function metaDate(metaRows: Cell[][]): string | null {
  const v = findMeta(metaRows, [
    /^(?:(?:invoice|packing\s*list|pl)\s*)?date\s*(?:[:\uff1a]\s*(.*))?$/i,
  ]);
  if (!v) return null;
  const n = Number(v);
  if (Number.isFinite(n)) return excelSerialToIso(n);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function finishReport(ctx: Ctx, imported: number, skipped: number): SpreadsheetBuildReport {
  for (const [key, count] of ctx.issueCounts) {
    const shown = ctx.issues.filter((i) => `${i.field ?? ""}|${i.column ?? ""}` === key).length;
    if (count > shown) {
      const [field] = key.split("|");
      ctx.warnings.push(`${count - shown} more row(s) had problems in "${field}" (only the first ${shown} are listed).`);
    }
  }
  return {
    issues: ctx.issues,
    warnings: Array.from(new Set(ctx.warnings)),
    rowsRead: ctx.table.rows.length,
    rowsImported: imported,
    rowsSkipped: skipped,
    extraColumns: extraColumnNames(ctx),
  };
}

function makeCtx(kind: MappingDocKind, table: SheetTable, mapping: ColumnMapping): Ctx {
  return {
    table,
    mapping,
    defs: new Map(getFieldDefs(kind).map((d) => [d.key, d])),
    issues: [],
    warnings: [],
    issueCounts: new Map(),
  };
}

function failNoLines(ctx: Ctx, skipped: number): never {
  const top = ctx.issues.slice(0, 3).map((i) => i.message);
  const detail = top.length ? ` ${top.join(" ")}` : "";
  throw new SpreadsheetImportError(
    `No valid lines could be imported from "${ctx.table.sheetName}" (${ctx.table.rows.length} rows read, ${skipped} skipped).${detail} Check the column mapping.`,
    ctx.issues,
  );
}

export type BuiltDocument<T> = { data: T; report: SpreadsheetBuildReport };

export function buildInvoiceFromTable(
  table: SheetTable,
  mapping: ColumnMapping,
  confidence: number,
): BuiltDocument<InvoiceExtractResult> {
  const ctx = makeCtx("invoice", table, mapping);
  const lines: InvoiceExtractResult["lines"] = [];
  const rawNumbers: Array<number | null> = [];
  let skipped = 0;
  let mismatches = 0;
  const descCol = colOf(ctx, "supplierDescription");
  const unitMissing = colOf(ctx, "unitOfMeasure") === null;
  let unitDefaulted = false;

  const currencyHeader = (() => {
    for (const key of ["unitPrice", "lineTotalAmount"]) {
      const c = colOf(ctx, key);
      if (c !== null) {
        const cur = detectCurrencyInHeader(table.headers[c]);
        if (cur) return cur;
      }
    }
    return null;
  })();

  table.rows.forEach((row, i) => {
    const rowNumber = table.rowNumbers[i];
    const description = descCol === null ? "" : cellText(row[descCol]);
    const qtyCell = raw(ctx, "quantity", row);
    // notes / section headings: text but no quantity, price or total -> not a line
    if (
      cellText(qtyCell) === "" &&
      cellText(raw(ctx, "unitPrice", row)) === "" &&
      cellText(raw(ctx, "lineTotalAmount", row)) === ""
    ) {
      skipped++;
      return;
    }
    if (!description) {
      // blank description: silently skip unless the row clearly holds a quantity
      if (cellText(qtyCell) !== "" && parseNumber(qtyCell) !== null && Object.values(row).filter((c) => cellText(c) !== "").length >= 3) {
        pushIssue(ctx, {
          row: rowNumber,
          column: cleanHeaderLabel(table.headers[descCol ?? 0]),
          field: label(ctx, "supplierDescription"),
          message: `Row ${rowNumber}: "${cleanHeaderLabel(table.headers[descCol ?? 0])}" is empty - row skipped.`,
        });
      }
      skipped++;
      return;
    }

    const qty = numberField(ctx, "quantity", row, rowNumber, 4);
    if (qty.bad) {
      skipped++;
      return;
    }
    if (qty.value === null) {
      const col = cleanHeaderLabel(table.headers[colOf(ctx, "quantity") ?? 0]);
      pushIssue(ctx, {
        row: rowNumber,
        column: col,
        field: label(ctx, "quantity"),
        message: `Row ${rowNumber}: "${col}" is empty for "${description.slice(0, 40)}".`,
      });
      skipped++;
      return;
    }

    const price = numberField(ctx, "unitPrice", row, rowNumber, 4);
    const totalCell = numberField(ctx, "lineTotalAmount", row, rowNumber, 2);
    let total = totalCell.value;
    const q = Number(qty.value);
    const p = price.value === null ? null : Number(price.value);
    if (total === null && p !== null && !totalCell.bad) total = roundDecimal(q * p, 2);
    if (total !== null && p !== null && !totalCell.bad && !price.bad) {
      const expected = q * p;
      if (Math.abs(expected - Number(total)) > Math.max(0.5, 0.02 * Math.abs(Number(total)))) mismatches++;
    }

    const unitRaw = textField(ctx, "unitOfMeasure", row);
    let unit = normalizeUnit(unitRaw);
    if (!unit) {
      unit = "PCS";
      if (!unitMissing) unitDefaulted = true;
    }

    const rowCurrency = textField(ctx, "currencyCode", row, 3);
    const num = (key: string, dp: number) => numberField(ctx, key, row, rowNumber, dp).value;
    const originRaw = textField(ctx, "countryOfOriginCode", row);
    const origin = originRaw ? countryCode(originRaw) : null;

    let extra = buildExtra(ctx, row);
    if (originRaw && !origin) {
      extra = { ...(extra ?? {}), "Country of origin": originRaw.slice(0, MAX_EXTRA_LEN) };
    }

    const lineNo = parseNumber(raw(ctx, "lineNumber", row));
    rawNumbers.push(lineNo);

    lines.push({
      lineNumber: undefined,
      supplierDescription: description,
      supplierSku: textField(ctx, "supplierSku", row, 100),
      brand: textField(ctx, "brand", row, 100),
      modelNumber: textField(ctx, "modelNumber", row, 100),
      quantity: qty.value,
      unitOfMeasure: unit,
      unitPrice: price.value,
      lineTotalAmount: total,
      currencyCode:
        rowCurrency && /^[A-Za-z]{3}$/.test(rowCurrency) ? rowCurrency.toUpperCase() : undefined,
      countryOfOriginCode: origin,
      declaredNetWeightKg: num("declaredNetWeightKg", 3),
      declaredGrossWeightKg: num("declaredGrossWeightKg", 3),
      extra,
    });
  });

  if (lines.length === 0) failNoLines(ctx, skipped);

  const numbers = lineNumbers(ctx, rawNumbers);
  lines.forEach((l, i) => {
    l.lineNumber = numbers[i];
  });

  if (unitDefaulted) ctx.warnings.push('Some rows had no unit - "PCS" was used.');
  if (mismatches > 0) {
    ctx.warnings.push(`${mismatches} row(s) where quantity x unit price does not match the total - check the totals.`);
  }

  const sum = lines.reduce((acc, l) => acc + (l.lineTotalAmount ? Number(l.lineTotalAmount) : 0), 0);
  const meta = table.metaRows;
  const data: InvoiceExtractResult = {
    documentNumber: findMeta(meta, [/^(?:commercial\s+)?invoice\s*(?:no|number|#)\.?\s*[:\uff1a]?\s*(.*)$/i, /^inv\.?\s*(?:no|#)\.?\s*[:\uff1a]?\s*(.*)$/i]),
    documentDate: metaDate(meta),
    supplierName: findMeta(meta, [SUPPLIER_LABEL]),
    buyerName: findMeta(meta, [/^(?:buyer|consignee|importer)(?:\s*\/\s*importer)?(?:\s*name)?\s*(?:[:\uff1a]\s*(.*))?$/i]),
    currencyCode: currencyHeader ?? findMeta(meta, [/^currency\s*(?:[:\uff1a]\s*(.*))?$/i]),
    invoiceTotalAmount: sum > 0 ? roundDecimal(sum, 2) : null,
    incoterm: findMeta(meta, [/^(?:incoterms?|trade\s*terms?|terms\s+of\s+delivery)\s*(?:[:\uff1a]\s*(.*))?$/i]),
    countryOfOriginCode: null,
    lines,
    confidence,
    missingFields: [],
  };
  const cur = data.currencyCode?.trim().toUpperCase() ?? null;
  data.currencyCode = cur && /^[A-Z]{3}$/.test(cur) ? cur : currencyHeader;

  return { data, report: finishReport(ctx, lines.length, skipped) };
}

export function buildPackingListFromTable(
  table: SheetTable,
  mapping: ColumnMapping,
  confidence: number,
): BuiltDocument<PackingListExtractResult> {
  const ctx = makeCtx("packing_list", table, mapping);
  const lines: PackingListExtractResult["lines"] = [];
  const rawNumbers: Array<number | null> = [];
  let skipped = 0;
  let unitDefaulted = false;
  const descCol = colOf(ctx, "supplierDescription");
  const unitMissing = colOf(ctx, "unitOfMeasure") === null;

  table.rows.forEach((row, i) => {
    const rowNumber = table.rowNumbers[i];
    const description = descCol === null ? "" : cellText(row[descCol]);
    if (!description) {
      skipped++;
      return;
    }
    if (
      ["quantity", "numberOfPackages", "netWeightKg", "grossWeightKg"].every(
        (k) => cellText(raw(ctx, k, row)) === "",
      )
    ) {
      skipped++;
      return;
    }
    const pkgs = numberField(ctx, "numberOfPackages", row, rowNumber, 2);
    const qtyField = numberField(ctx, "quantity", row, rowNumber, 4);
    if (qtyField.bad || pkgs.bad) {
      skipped++;
      return;
    }
    const quantity = qtyField.value ?? pkgs.value;
    if (quantity === null) {
      const col = cleanHeaderLabel(
        table.headers[colOf(ctx, "quantity") ?? colOf(ctx, "numberOfPackages") ?? 0],
      );
      pushIssue(ctx, {
        row: rowNumber,
        column: col,
        field: label(ctx, "quantity"),
        message: `Row ${rowNumber}: no quantity or package count for "${description.slice(0, 40)}".`,
      });
      skipped++;
      return;
    }
    let unit = normalizeUnit(textField(ctx, "unitOfMeasure", row));
    if (!unit) {
      unit = "PCS";
      if (!unitMissing) unitDefaulted = true;
    }
    const num = (key: string, dp: number) => numberField(ctx, key, row, rowNumber, dp).value;
    const originRaw = textField(ctx, "countryOfOriginCode", row);
    const origin = originRaw ? countryCode(originRaw) : null;
    let extra = buildExtra(ctx, row);
    if (originRaw && !origin) {
      extra = { ...(extra ?? {}), "Country of origin": originRaw.slice(0, MAX_EXTRA_LEN) };
    }
    rawNumbers.push(parseNumber(raw(ctx, "lineNumber", row)));
    lines.push({
      lineNumber: undefined,
      supplierDescription: description,
      supplierSku: textField(ctx, "supplierSku", row, 100),
      brand: textField(ctx, "brand", row, 100),
      modelNumber: textField(ctx, "modelNumber", row, 100),
      quantity,
      unitOfMeasure: unit,
      packageType: textField(ctx, "packageType", row, 50),
      numberOfPackages: pkgs.value,
      piecesPerPackage: num("piecesPerPackage", 4),
      netWeightKg: num("netWeightKg", 3),
      grossWeightKg: num("grossWeightKg", 3),
      packageMarks: textField(ctx, "packageMarks", row),
      countryOfOriginCode: origin,
      extra,
    });
  });

  if (lines.length === 0) failNoLines(ctx, skipped);

  const numbers = lineNumbers(ctx, rawNumbers);
  lines.forEach((l, idx) => {
    l.lineNumber = numbers[idx];
  });
  if (unitDefaulted) ctx.warnings.push('Some rows had no unit - "PCS" was used.');

  const hasWeights = lines.some((l) => l.netWeightKg || l.grossWeightKg);
  if (colOf(ctx, "netWeightKg") === null && colOf(ctx, "grossWeightKg") === null) {
    ctx.warnings.push("No gross/net weight columns were mapped - weights are empty on every line.");
  } else if (!hasWeights) {
    ctx.warnings.push("The weight columns are mapped but contain no usable numbers.");
  }
  if (colOf(ctx, "numberOfPackages") === null && colOf(ctx, "piecesPerPackage") === null) {
    ctx.warnings.push("No package/carton columns were mapped - package counts are empty.");
  }

  const meta = table.metaRows;
  const data: PackingListExtractResult = {
    documentNumber: findMeta(meta, [/^(?:packing\s*list|p\/?l)\s*(?:no|number|#)\.?\s*[:\uff1a]?\s*(.*)$/i]),
    documentDate: metaDate(meta),
    relatedInvoiceNumber: findMeta(meta, [/^(?:related\s+|commercial\s+)?invoice\s*(?:no|number|#)\.?\s*[:\uff1a]?\s*(.*)$/i]),
    supplierName: findMeta(meta, [SUPPLIER_LABEL]),
    shipmentReference: findMeta(meta, [/^(?:shipment\s*ref(?:erence)?|b\/?l\s*(?:no|number)|container\s*(?:no|number))\.?\s*[:\uff1a]?\s*(.*)$/i]),
    lines,
    confidence,
    missingFields: [],
  };
  return { data, report: finishReport(ctx, lines.length, skipped) };
}
