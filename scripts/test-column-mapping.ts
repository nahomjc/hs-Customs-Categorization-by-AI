/**
 * Offline test for spreadsheet reading + column suggestion + line building.
 * No database and no AI calls.
 *
 *   npm run test:column-mapping
 *   npx tsx scripts/test-column-mapping.ts [folder-with-invoice-a.xlsx-and-invoice-b.xlsx]
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import {
  analyzeColumns,
  mappingFromAnalysis,
  normalizeHeader,
  parseNumber,
  roundDecimal,
  hsDigits,
  headerSignature,
  mappingToSaved,
  savedToMapping,
  type Cell,
  type MappingAnalysis,
  type MappingDocKind,
} from "../lib/import-cases/column-mapping";
import { readSpreadsheetTable } from "../lib/import-cases/spreadsheet-reader";
import {
  buildInvoiceFromTable,
  buildPackingListFromTable,
  SpreadsheetImportError,
} from "../lib/import-cases/spreadsheet-import";

type Row = {
  name: string;
  kind: MappingDocKind;
  headerRow: number | string;
  sure: string;
  rows: string;
  mapped: string;
  extras: string;
  result: "PASS" | "FAIL";
  note: string;
};

const table: Row[] = [];
let failures = 0;

function workbook(sheets: Array<{ name: string; rows: Cell[][] }>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function short(analysis: MappingAnalysis, headers: string[]): string {
  return Object.values(analysis.suggestions)
    .filter((s) => s.columnIndex !== null)
    .map((s) => `${s.fieldKey}=${headers[s.columnIndex!].replace(/\s+/g, " ")}(${s.confidence[0]})`)
    .join("; ");
}

type Expect = {
  sure: boolean;
  headerRow?: number;
  rows?: number;
  fields?: Record<string, string>; // field -> header (normalized compare)
  extras?: string[];
  reasonIncludes?: string;
  warningIncludes?: string;
  noFail?: boolean;
  /** Inspect the built document; return an error message or null. */
  check?: (data: ReturnType<typeof buildInvoiceFromTable>["data"] | ReturnType<typeof buildPackingListFromTable>["data"]) => string | null;
};

function run(name: string, kind: MappingDocKind, buffer: Buffer, expect: Expect, opts: { forceBuild?: boolean } = {}) {
  const notes: string[] = [];
  let ok = true;
  const fail = (msg: string) => {
    ok = false;
    notes.push(msg);
  };
  const read = readSpreadsheetTable(buffer, { kind });
  if (!read.table) {
    table.push({ name, kind, headerRow: "-", sure: "-", rows: "-", mapped: "-", extras: "-", result: "FAIL", note: read.error ?? "no table" });
    failures++;
    return;
  }
  const t = read.table;
  const analysis = analyzeColumns({ kind, headers: t.headers, rows: t.rows });
  if (analysis.sure !== expect.sure) fail(`sure=${analysis.sure} expected ${expect.sure} (${analysis.reasons.join(" | ")})`);
  if (expect.headerRow !== undefined && t.headerRowNumber !== expect.headerRow) fail(`headerRow=${t.headerRowNumber}`);
  for (const [field, header] of Object.entries(expect.fields ?? {})) {
    const s = analysis.suggestions[field];
    const got = s?.columnIndex === null || s === undefined ? "(none)" : t.headers[s.columnIndex];
    if (normalizeHeader(got) !== normalizeHeader(header)) fail(`${field}->${got} expected ${header}`);
  }
  if (expect.reasonIncludes && !analysis.reasons.some((r) => r.toLowerCase().includes(expect.reasonIncludes!.toLowerCase()))) {
    fail(`reason missing "${expect.reasonIncludes}"`);
  }
  if (expect.warningIncludes) {
    const all = analysis.warnings.map((w) => w.toLowerCase());
    // warnings from the builder are added below
    notes.push(`analysis warnings: ${all.length}`);
  }

  let imported = "-";
  let extras = "-";
  if (analysis.sure || opts.forceBuild) {
    try {
      const mapping = mappingFromAnalysis(analysis, t.headers);
      const built =
        kind === "invoice"
          ? buildInvoiceFromTable(t, mapping, 0.9)
          : buildPackingListFromTable(t, mapping, 0.9);
      imported = `${built.report.rowsImported}/${built.report.rowsRead}`;
      extras = built.report.extraColumns.join(",") || "-";
      if (expect.rows !== undefined && built.report.rowsImported !== expect.rows) fail(`imported ${built.report.rowsImported} expected ${expect.rows}`);
      const checkMsg = expect.check?.(built.data) ?? null;
      if (checkMsg) fail(checkMsg);
      if (expect.extras && JSON.stringify(built.report.extraColumns) !== JSON.stringify(expect.extras)) {
        fail(`extras ${JSON.stringify(built.report.extraColumns)}`);
      }
      if (expect.warningIncludes && ![...built.report.warnings, ...analysis.warnings].some((w) => w.toLowerCase().includes(expect.warningIncludes!.toLowerCase()))) {
        fail(`warning missing "${expect.warningIncludes}"`);
      }
    } catch (e) {
      if (!expect.noFail) fail(`build error: ${e instanceof Error ? e.message : String(e)}`);
      else notes.push(`build error (expected): ${(e as Error).message.slice(0, 80)}`);
    }
  }

  if (!ok) failures++;
  table.push({
    name,
    kind,
    headerRow: t.headerRowNumber,
    sure: analysis.sure ? "sure" : "UNSURE",
    rows: imported,
    mapped: short(analysis, t.headers),
    extras,
    result: ok ? "PASS" : "FAIL",
    note: (analysis.sure ? "" : analysis.reasons.join(" | ")) + (notes.length ? ` ${notes.join(" ; ")}` : ""),
  });
}

// ---------------------------------------------------------------------------
// unit checks
// ---------------------------------------------------------------------------
function unit(name: string, cond: boolean, detail = "") {
  if (!cond) failures++;
  table.push({ name: `unit: ${name}`, kind: "invoice", headerRow: "-", sure: "-", rows: "-", mapped: detail, extras: "-", result: cond ? "PASS" : "FAIL", note: "" });
}

unit("normalize 'UNIT VALUE\\n(USD)'", normalizeHeader("UNIT VALUE\n(USD)") === "unit value", normalizeHeader("UNIT VALUE\n(USD)"));
unit("normalize full-width 'Amount （USD）'", normalizeHeader("Amount （USD）") === "amount", normalizeHeader("Amount （USD）"));
unit("normalize 'G.W. (KGS)'", normalizeHeader("G.W. (KGS)") === "gw", normalizeHeader("G.W. (KGS)"));
unit("normalize 'S/N' and 'No.'", normalizeHeader("S/N") === "sn" && normalizeHeader("No.") === "no");
unit("normalize 'Gross Weight kg'", normalizeHeader("Gross Weight kg") === "gross weight", normalizeHeader("Gross Weight kg"));
unit("parseNumber text", parseNumber("1.95") === 1.95 && parseNumber("1,234.50") === 1234.5 && parseNumber("1.234,50") === 1234.5 && parseNumber("12 kg") === 12 && parseNumber("abc") === null && parseNumber("") === null);
unit("round 27.500000000000004", roundDecimal(27.500000000000004, 2) === "27.5", roundDecimal(27.500000000000004, 2));
unit("hsDigits trims/pads", hsDigits("07129000 ") === "07129000" && hsDigits(9109900) === "09109900" && hsDigits("0712.90.00") === "07129000" && hsDigits("abc") === null);
{
  const sig1 = headerSignature(["A", "Qty", "Unit price"]);
  const sig2 = headerSignature(["Unit Price (USD)", "A", "QTY"]);
  unit("header signature is order/format independent", sig1 === sig2, `${sig1}/${sig2}`);
}

// ---------------------------------------------------------------------------
// sample files from the user
// ---------------------------------------------------------------------------
const sampleDir = process.argv[2] ?? join(process.env.TEMP ?? ".", "hs-samples");
const samples: Array<[string, string, Record<string, string>]> = [
  ["sample invoice A (No/DESCRIPTION OF GOODS...)", "invoice-a.xlsx", { supplierDescription: "DESCRIPTION OF GOODS", quantity: "QTY", unitPrice: "UNIT VALUE (USD)", lineTotalAmount: "TOTAL VALUE (USD)", hsCode: "HS CODE", unitOfMeasure: "UNIT OF MEASURE", lineNumber: "No" }],
  ["sample invoice B (Item/Description...)", "invoice-b.xlsx", { supplierDescription: "Description", quantity: "Qty", unitPrice: "Unit price (USD)", lineTotalAmount: "Amount (USD)", hsCode: "HS Code", unitOfMeasure: "Unit", lineNumber: "Item" }],
];
for (const [label, file, sampleFields] of samples) {
  const path = join(sampleDir, file);
  if (!existsSync(path)) {
    table.push({ name: label, kind: "invoice", headerRow: "-", sure: "-", rows: "-", mapped: "-", extras: "-", result: "FAIL", note: `missing ${path}` });
    failures++;
    continue;
  }
  const buf = readFileSync(path);
  run(
    `${label} as invoice`,
    "invoice",
    buf,
    {
      sure: true,
      headerRow: 1,
      rows: 112,
      fields: sampleFields,
      check: (data) => {
        const l = (data as { lines: Array<Record<string, unknown>> }).lines;
        const first = l[0];
        const third = l[2];
        if (first.supplierDescription !== "Rice") return `first description "${String(first.supplierDescription)}"`;
        if (first.quantity !== "410" || first.unitPrice !== "1.95" || first.lineTotalAmount !== "799.5") return `first line numbers ${String(first.quantity)}/${String(first.unitPrice)}/${String(first.lineTotalAmount)}`;
        if (first.unitOfMeasure !== "BAG") return `first unit ${String(first.unitOfMeasure)}`;
        if (third.lineTotalAmount !== "27.5") return `float noise not removed: ${String(third.lineTotalAmount)}`;
        const hs = (l[111].extra as Record<string, string> | null)?.["HS code"];
        if (hs !== "2103.9000") return `last HS code "${String(hs)}"`;
        if ((l[6].extra as Record<string, string> | null)?.["HS code"]?.includes(" ")) return "HS code has spaces";
        if (l.some((x, i) => x.lineNumber !== i + 1)) return "line numbers not 1..n";
        return null;
      },
    },
  );
  run(
    `${label} as packing list (wrong file?)`,
    "packing_list",
    buf,
    { sure: false, reasonIncludes: "looks like an invoice", rows: 112 },
    { forceBuild: true },
  );
}

// ---------------------------------------------------------------------------
// synthetic variants
// ---------------------------------------------------------------------------
const base = [
  ["Rice ", "25kg bag", 10064000, "BAG ", "410", "1.95", "799.5"],
  ["Mineral Water", "1.75L*6", "22029990", "CTNS", "150", "2.3", "345"],
  ["Canned meat", "340g*24", "16042000", "CTNS", "25", "1.1", "27.500000000000004"],
  ["Oyster Sauce", "6kg*2", "21039000 ", "CTNS", "30", "2.9", "87"],
];
const std = ["Description", "Specification", "HS Code", "Unit", "Qty", "Unit Price", "Amount"];

run("renamed headers", "invoice", workbook([{ name: "Sheet1", rows: [["Goods", "Spec", "Tariff No.", "UoM", "Quantity", "Price (USD)", "Total Amount"], ...base] }]), {
  sure: true,
  rows: 4,
  fields: { supplierDescription: "Goods", quantity: "Quantity", unitPrice: "Price", lineTotalAmount: "Total Amount", unitOfMeasure: "UoM", hsCode: "Tariff No." },
});

// shuffled columns
{
  const order = [4, 0, 6, 2, 5, 1, 3];
  const shuffled = [order.map((i) => std[i]), ...base.map((r) => order.map((i) => r[i]))];
  run("shuffled columns", "invoice", workbook([{ name: "Sheet1", rows: shuffled as Cell[][] }]), {
    sure: true,
    rows: 4,
    fields: { supplierDescription: "Description", quantity: "Qty", unitPrice: "Unit Price", lineTotalAmount: "Amount" },
  });
}

run("extra new columns (Remarks, Brand-like)", "invoice", workbook([{ name: "Sheet1", rows: [[...std, "Remarks", "Batch", "Pallet No"], ...base.map((r, i) => [...r, i % 2 ? "fragile" : "", `B${i}`, i + 1])] }]), {
  sure: true,
  rows: 4,
  extras: ["Remarks", "Batch", "Pallet No"],
});

run("header on row 4 with meta rows above", "invoice", workbook([{ name: "Sheet1", rows: [
  ["COMMERCIAL INVOICE"],
  ["Invoice No:", "INV-2024-001", null, "Date:", "2024-05-01"],
  ["Supplier:", "Shandong Foods Ltd"],
  [],
  std,
  ...base,
  ["Total", null, null, null, 615, null, 1259.0],
] }]), {
  sure: true,
  headerRow: 5,
  rows: 4,
  check: (data) => {
    const d = data as { documentNumber?: string | null; supplierName?: string | null; documentDate?: string | null; invoiceTotalAmount?: string | null };
    if (d.documentNumber !== "INV-2024-001") return `documentNumber=${String(d.documentNumber)}`;
    if (d.supplierName !== "Shandong Foods Ltd") return `supplier=${String(d.supplierName)}`;
    if (d.documentDate !== "2024-05-01") return `date=${String(d.documentDate)}`;
    if (d.invoiceTotalAmount !== "1259") return `invoiceTotal=${String(d.invoiceTotalAmount)}`;
    return null;
  },
});

run("missing total column", "invoice", workbook([{ name: "Sheet1", rows: [["Description", "Unit", "Qty", "Unit Price"], ...base.map((r) => [r[0], r[3], r[4], r[5]])] }]), {
  sure: true,
  rows: 4,
  warningIncludes: "calculated as quantity",
});

run("missing quantity column (required)", "invoice", workbook([{ name: "Sheet1", rows: [["Description", "Unit", "Unit Price", "Amount"], ...base.map((r) => [r[0], r[3], r[5], r[6]])] }]), {
  sure: false,
  reasonIncludes: "Quantity column not found",
});

run("ambiguous: two unit price columns", "invoice", workbook([{ name: "Sheet1", rows: [["Description", "Qty", "Unit Price USD", "Unit Price RMB", "Amount"], ...base.map((r) => [r[0], r[4], r[5], r[5], r[6]])] }]), {
  sure: false,
  reasonIncludes: "Several columns",
});

run("unknown headers, content-based", "invoice", workbook([{ name: "Sheet1", rows: [["Col 1", "Col 2", "Col 3", "Col 4", "Col 5"], ["Rice bag premium", 410, 1.95, 799.5, "BAG"], ["Mineral Water bottle", 150, 2.3, 345, "CTNS"], ["Canned meat tin food", 25, 1.1, 27.5, "CTNS"], ["Oyster Sauce glass", 30, 2.9, 87, "CTNS"]] }]), {
  sure: false,
  fields: { supplierDescription: "Col 1", quantity: "Col 2", unitPrice: "Col 3", lineTotalAmount: "Col 4", unitOfMeasure: "Col 5" },
}, { forceBuild: true });

run("empty sheets + data on 2nd sheet", "invoice", workbook([
  { name: "Empty1", rows: [[]] },
  { name: "Data", rows: [std, ...base] },
  { name: "Empty2", rows: [[null, null]] },
]), { sure: true, rows: 4 });

run("non-numeric quantity row is reported, not fatal", "invoice", workbook([{ name: "Sheet1", rows: [std, ...base, ["Bad row", "x", "1", "PCS", "abc", "1", "1"]] }]), {
  sure: true,
  rows: 4,
});

// packing list
const pstd = ["No", "Description", "Qty", "Unit", "CTNS", "N.W. (KGS)", "G.W. (KGS)", "CBM"];
run("packing list with weights", "packing_list", workbook([{ name: "PL", rows: [pstd, [1, "Rice", 410, "BAG", 41, 10250, 10500, 12.5], [2, "Water", 150, "CTNS", 150, 1500, 1620, 9.1], [3, "Canned", 25, "CTNS", 25, 400, 430, 1.2], ["Total", null, 585, null, 216, 12150, 12550, 22.8]] }]), {
  sure: true,
  rows: 3,
  fields: { netWeightKg: "N.W. (KGS)", grossWeightKg: "G.W. (KGS)", numberOfPackages: "CTNS", cbm: "CBM", quantity: "Qty" },
});

run("packing list, no weight/package columns", "packing_list", workbook([{ name: "PL", rows: [["No", "Description", "Qty", "Unit"], [1, "Rice", 410, "BAG"], [2, "Water", 150, "CTNS"], [3, "Canned", 25, "CTNS"]] }]), {
  sure: false,
  reasonIncludes: "No weight or package columns",
  rows: 3,
}, { forceBuild: true });

// saved mapping round-trip
{
  const buf = workbook([{ name: "Sheet1", rows: [["Goods", "Spec", "Tariff No.", "UoM", "Quantity", "Price (USD)", "Total Amount"], ...base] }]);
  const t = readSpreadsheetTable(buf, { kind: "invoice" }).table!;
  const a = analyzeColumns({ kind: "invoice", headers: t.headers, rows: t.rows });
  const m = mappingFromAnalysis(a, t.headers);
  const saved = mappingToSaved(m, t.headers);
  const shuffledHeaders = [...t.headers].reverse();
  const restored = savedToMapping(saved, shuffledHeaders);
  const ok = !!restored && restored.fields.quantity === shuffledHeaders.indexOf("Quantity");
  unit("saved mapping restores by header name (shuffled)", ok);
  const missing = savedToMapping(saved, ["Foo", "Bar"]);
  unit("saved mapping rejected when headers differ", missing === null);
}

// build errors carry row/column
{
  const buf = workbook([{ name: "Sheet1", rows: [["Description", "Qty", "Unit Price", "Amount"], ["Rice", "abc", "1", "1"], ["Water", "n/a", "1", "1"]] }]);
  const t = readSpreadsheetTable(buf, { kind: "invoice" }).table!;
  const a = analyzeColumns({ kind: "invoice", headers: t.headers, rows: t.rows });
  try {
    buildInvoiceFromTable(t, mappingFromAnalysis(a, t.headers), 0.9);
    unit("all-bad rows -> specific error", false, "no error thrown");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    unit("all-bad rows -> specific error", e instanceof SpreadsheetImportError && msg.includes('Row 2: "Qty" value "abc" is not a number'), msg.slice(0, 120));
  }
}

// the CSV templates shipped in public/samples must keep working
for (const [file, kind] of [
  ["commercial-invoice-sample.csv", "invoice"],
  ["packing-list-sample.csv", "packing_list"],
] as const) {
  const path = join("public", "samples", file);
  if (!existsSync(path)) continue;
  run(`template ${file}`, kind, readFileSync(path), {
    sure: true,
    rows: 3,
    check: (data) => {
      const d = data as { supplierName?: string | null; documentNumber?: string | null };
      if (d.supplierName !== "Shenzhen Bright LED Co. Ltd.") return `supplier=${String(d.supplierName)}`;
      if (!d.documentNumber?.includes("2026-0847")) return `documentNumber=${String(d.documentNumber)}`;
      return null;
    },
  });
}

// ---------------------------------------------------------------------------
console.log("");
for (const r of table) {
  console.log(
    `${r.result}  ${r.name}\n      kind=${r.kind} headerRow=${r.headerRow} ${r.sure} imported=${r.rows}${r.extras !== "-" ? ` extras=[${r.extras}]` : ""}` +
      `${r.mapped ? `\n      ${r.mapped}` : ""}${r.note ? `\n      note: ${r.note}` : ""}`,
  );
}
console.log(`\n${table.length - failures}/${table.length} passed`);
process.exit(failures ? 1 : 0);
