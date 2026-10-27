/**
 * Which product names would the word check flag? Offline: no AI, no web, and it
 * WRITES NOTHING (read-only selects, or a spreadsheet file).
 *
 *   npx tsx --env-file=.env scripts/scan-keyword-flags.ts            # every case in the database
 *   npx tsx --env-file=.env scripts/scan-keyword-flags.ts IMP-2026-00011
 *   npx tsx scripts/scan-keyword-flags.ts --file "C:\path\invoice.xlsx"   # a spreadsheet (names + optional HS column)
 *
 * For each product it checks (1) the stored code (if any) and the supplier's invoice
 * code against the word check and (2) what the offline tariff-book match would give.
 * Only names, codes and chapter numbers are printed.
 */
import "./stub-server-only";
import * as XLSX from "xlsx";
import { classifyFromReferenceDescription } from "../lib/classifyFromReference";
import { checkPlausibility, shortProductLabel } from "../lib/hs-plausibility";

type Item = { where: string; name: string; text: string[]; storedCode?: string | null; supplierCode?: string | null };

function fromFile(path: string): Item[] {
  const wb = XLSX.readFile(path);
  const items: Item[] = [];
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: "" });
    for (const [i, row] of rows.entries()) {
      const keys = Object.keys(row);
      const nameKey = keys.find((k) => /desc|product|item|goods|name|particulars/i.test(k));
      const hsKey = keys.find((k) => /^\s*(?:h\.?s\.?|hts|hsn|tariff|commodity)/i.test(k));
      const name = String(nameKey ? row[nameKey] : "").trim();
      if (!name) continue;
      items.push({
        where: `${sheetName} row ${i + 2}`,
        name,
        text: [name],
        supplierCode: hsKey ? String(row[hsKey]).replace(/\D/g, "") || null : null,
      });
    }
  }
  return items;
}

async function fromDatabase(caseNumber: string | null): Promise<Item[]> {
  const { db } = await import("../db");
  const { and, eq, inArray } = await import("drizzle-orm");
  const { importCases, importProducts, productClassifications } = await import("../db/schema");
  const { loadSupplierHsByProduct } = await import("../lib/import-cases/product-context-load");
  const cases = await db
    .select({ id: importCases.id, caseNumber: importCases.caseNumber })
    .from(importCases)
    .where(caseNumber ? eq(importCases.caseNumber, caseNumber) : undefined);
  const items: Item[] = [];
  for (const c of cases) {
    const products = await db
      .select()
      .from(importProducts)
      .where(and(eq(importProducts.importCaseId, c.id)))
      .orderBy(importProducts.productSequence);
    if (products.length === 0) continue;
    const classes = await db
      .select()
      .from(productClassifications)
      .where(inArray(productClassifications.productId, products.map((p) => p.id)));
    const byProduct = new Map(classes.map((x) => [x.productId, x]));
    const supplier = await loadSupplierHsByProduct(c.id);
    for (const p of products) {
      items.push({
        where: `${c.caseNumber} #${p.productSequence}`,
        name: p.productName ?? p.normalizedDescription ?? p.rawDescription,
        text: [p.productName, p.rawDescription, p.normalizedDescription].filter((t): t is string => Boolean(t)),
        storedCode: byProduct.get(p.id)?.hsCode ?? null,
        supplierCode: supplier.get(p.id) ?? null,
      });
    }
  }
  return items;
}

async function main() {
  const args = process.argv.slice(2);
  const fileAt = args.indexOf("--file");
  const items =
    fileAt >= 0 ? fromFile(args[fileAt + 1]) : await fromDatabase(args.find((a) => !a.startsWith("--")) ?? null);

  if (fileAt < 0) {
    const { loadHsReferenceCache } = await import("../lib/hsReference");
    await loadHsReferenceCache();
  }

  const flagged: string[] = [];
  let withWord = 0;
  for (const it of items) {
    const label = shortProductLabel(it.name) || it.name;
    const lines: string[] = [];
    const codes: Array<[string, string | null | undefined]> = [
      ["stored code", it.storedCode],
      ["invoice code", it.supplierCode],
    ];
    const ref = classifyFromReferenceDescription(label, { supplierHsCode: it.supplierCode });
    if (ref) codes.push(["tariff-book match", ref.hsCode]);
    for (const [what, code] of codes) {
      if (!code) continue;
      const v = checkPlausibility({ hsCode: code, texts: it.text });
      if (v.status === "implausible") {
        lines.push(`${what} ${code}: sees "${v.trigger ?? "?"}" -> ${v.family} (chapter ${v.chapter})`);
      }
    }
    if (lines.length > 0) {
      withWord++;
      flagged.push(`- ${it.where}: ${label}\n    ${lines.join("\n    ")}`);
    }
  }
  console.log(`Checked ${items.length} product line(s); ${withWord} would get a word-check warning.\n`);
  console.log(flagged.length > 0 ? flagged.join("\n") : "(none)");
  process.exit(0);
}

void main();