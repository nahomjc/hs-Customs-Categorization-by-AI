/**
 * Offline test for the HS plausibility check and the export / grouping fixes:
 * generic food-vs-vehicle plausibility, whole-word tariff matching, the
 * supplier's invoice code as a hint, duty and code normalisation, the
 * "every product is included" guarantee and the origin fill. Made-up generic
 * names only. No database, no network.
 *
 *   npm run test:hs-plausibility
 */
import "./stub-server-only";
import assert from "node:assert/strict";
import { completeHsCode, formatHsCode } from "../lib/hs-code-format";
import {
  blocksApproval,
  chapterOfCode,
  checkPlausibility,
  extractSupplierHsCode,
  needsRecheck,
  sectionOfChapter,
  shortProductLabel,
} from "../lib/hs-plausibility";
import {
  findBestReferenceMatch,
  invalidateHsReferenceCache,
  setHsReferenceCache,
  type HsReferenceCacheRow,
} from "../lib/hsReferenceCache";
import { normalizeDutyRate } from "../lib/import-cases/duty-format";
import { formatDutyRateFromSnapshot } from "../lib/import-cases/duty-rate-display";
import {
  caseOriginFallback,
  displayOrigin,
  ORIGIN_NOT_PROVIDED,
  resolveProductOrigin,
} from "../lib/import-cases/origin";
import {
  gateFirstPass,
  gateStepResult,
  supplierOption,
} from "../lib/import-cases/plausibility-gate";
import { parseDutyRate } from "../lib/import-cases/tariff-lookup";
import { findUnclassifiedProducts } from "../lib/import-cases/unclassified";
import {
  exportGroupOrigin,
  exportHsCode,
  exportProductOrigin,
  generateDeclarationCsv,
} from "../lib/import-cases/export-declaration";
import type { GroupingWithProducts } from "../lib/import-cases/grouping-queries";
import type { FirstPass, StepResult } from "../lib/import-cases/hs-web-step";

let passed = 0;
let failed = 0;
const pending: Promise<void>[] = [];
function test(name: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try {
      await fn();
      passed++;
      console.log(`  ok  ${name}`);
    } catch (error) {
      failed++;
      console.log(`  FAIL ${name}\n       ${(error as Error).message}`);
    }
  };
  pending.push(
    pending.length === 0 ? run() : pending[pending.length - 1].then(run),
  );
}

function row(hsCode: string, description: string, dutyRate = "20"): HsReferenceCacheRow {
  const digits = hsCode.replace(/\D/g, "");
  return {
    heading: digits.slice(0, 4),
    hsCode,
    normalizedHs: digits.length >= 8 ? digits : null,
    tariffNo: hsCode,
    description,
    stdUnit: "kg",
    dutyRate,
    chapter: digits.slice(0, 2),
  };
}

const BOOK: HsReferenceCacheRow[] = [
  row("1102.9000", "Rice flour"),
  row("1006.3000", "Semi-milled or wholly milled rice, whether or not polished"),
  row("1006", "Rice"),
  row("0904.2200", "Chili powder, ground"),
  row("0909.3200", "Cumin seeds, crushed or ground"),
  row("0406.2000", "Grated or powdered cheese, of all kinds"),
  row("0902.1000", "Green tea in immediate packings of a content not exceeding 3 kg"),
  row("2103.1000", "Soya sauce"),
  row("2103.9000", "Sauces and preparations therefor, other"),
  row("8541.4200", "Photovoltaic cells not assembled in modules"),
  row("8703.1020", "Used motor cars for the transport of persons"),
  row("1503.0000", "Lard stearin, lard oil, oleostearin and oleo-oil"),
  row("1601", "Sausages and similar products of meat"),
  row("1601.0000", "Sausages and similar products of meat"),
  row("2008.1900", "Nuts, otherwise prepared or preserved"),
  row("7323.9300", "Table, kitchen or other household articles of stainless steel"),
];

console.log("hs plausibility, normalisation and export");

/* ---------------------- plausibility: food vs vehicle --------------------- */

function verdict(text: string, hsCode: string, supplier?: string) {
  return checkPlausibility({ hsCode, texts: [text], supplierHsCode: supplier });
}

test("rice flour in an electronics code is implausible, in a cereal code it is fine", () => {
  assert.equal(verdict("Rice Flour", "8541.4200").status, "implausible");
  assert.equal(verdict("Rice Flour", "1102.9000").status, "ok");
});

test("food in a motor-vehicle code is implausible", () => {
  for (const name of ["Cheese powder", "Cumin powder", "Fennel seeds", "Chili sauce"]) {
    const v = verdict(name, "8703.1020");
    assert.equal(v.status, "implausible", name);
    assert.ok(v.reasons[0].includes("chapter"), name);
  }
});

test("tea or chili sauce in the fats chapter and soy sauce in an electrical code are caught", () => {
  assert.equal(verdict("Chili sauce", "1503.0000").status, "implausible");
  assert.equal(verdict("Cooking oil", "1507.9000").status, "ok", "an oil may sit in the fats chapter");
  assert.equal(verdict("Green Tea", "1503.0000").status, "implausible");
  assert.equal(verdict("Green Tea", "0902.1000").status, "ok");
  assert.equal(verdict("Light Soy Sauce", "8512.1000").status, "implausible");
  assert.equal(verdict("Light Soy Sauce", "2103.1000").status, "ok");
});

test("whole words only: 'milled' is not 'led' and 'light soy sauce' is not a light fitting", () => {
  assert.equal(verdict("Milled rice", "1006.3000").status, "ok");
  assert.equal(verdict("Milled rice", "9405.1000").status, "implausible");
  assert.equal(verdict("Light Soy Sauce", "9405.1000").status, "implausible");
});

test("kitchenware fits household-article chapters, not vehicles", () => {
  assert.equal(verdict("Stainless steel steamer", "7323.9300").status, "ok");
  assert.equal(verdict("Stainless steel steamer", "8703.1020").status, "implausible");
});

test("no code, a placeholder or an unrecognised product is 'unknown', never a false alarm", () => {
  assert.equal(verdict("Rice Flour", "9999.9999").status, "unknown");
  assert.equal(checkPlausibility({ hsCode: null, texts: ["Rice"] }).status, "unknown");
  // a product that names no kind of thing cannot be judged: ok, with no family
  const none = verdict("Zorblax 3000", "8703.1020");
  assert.equal(none.status, "ok");
  assert.equal(none.family, null);
});

test("the supplier's invoice code is a hint: a different chapter means 'check', not 'wrong'", () => {
  const v = verdict("Rice", "1006.3000", "1905.9090");
  assert.equal(v.status, "check");
  assert.ok(needsRecheck(v));
  assert.ok(!blocksApproval(v), "a hint alone never blocks approval");
  assert.equal(v.supplierHsCode, "19059090");
  assert.equal(verdict("Rice", "1006.3000", "1006.3000").status, "ok");
  // an implausible code stays implausible whatever the supplier said
  assert.equal(verdict("Rice Flour", "8541.4200", "8541.4200").status, "implausible");
});

test("chapter and section of a code", () => {
  assert.equal(chapterOfCode("8703.1020"), "87");
  assert.equal(chapterOfCode("1601"), "16");
  assert.equal(chapterOfCode("x"), null);
  assert.equal(sectionOfChapter("87")?.id, "XVII");
  assert.equal(sectionOfChapter("09")?.id, "II");
  assert.equal(sectionOfChapter("16")?.id, "IV");
});

test("the supplier's HS code is read from an invoice 'HS CODE' column", () => {
  assert.equal(extractSupplierHsCode([{ "HS CODE": "1905.90.90" }]), "19059090");
  assert.equal(extractSupplierHsCode([null, { hs_code: 2103 }]), "2103");
  assert.equal(extractSupplierHsCode([{ Weight: "12" }]), null);
  assert.equal(extractSupplierHsCode([{ "HS CODE": "n/a" }]), null);
});

test("short product label drops the explanation words", () => {
  assert.equal(shortProductLabel("Cumin powder, a spice made from ground cumin seeds"), "Cumin powder");
  assert.equal(shortProductLabel("Rice Flour"), "Rice Flour");
});

/* --------------------------- tariff book matching -------------------------- */

test("whole-word matching: no 'Used' or 'Nuts' or 'stearin' false hits", () => {
  setHsReferenceCache(BOOK);
  try {
    const cheese = findBestReferenceMatch("Cheese powder");
    assert.ok(cheese);
    assert.ok(!cheese.row.hsCode?.startsWith("87"), `got ${cheese.row.hsCode}`);
    assert.equal(cheese.row.hsCode, "0406.2000");

    const flour = findBestReferenceMatch("Rice Flour");
    assert.equal(flour?.row.hsCode, "1102.9000");

    const tea = findBestReferenceMatch("Green tea");
    assert.equal(tea?.row.hsCode, "0902.1000");

    assert.equal(findBestReferenceMatch("Cashew"), null, "a word that is only a fragment of other rows");
  } finally {
    invalidateHsReferenceCache();
  }
});

test("8-digit rows are preferred over legacy 4-digit rows", () => {
  setHsReferenceCache(BOOK);
  try {
    const rice = findBestReferenceMatch("Milled rice");
    assert.equal(rice?.row.hsCode, "1006.3000");
    assert.ok((rice?.row.hsCode ?? "").replace(/\D/g, "").length >= 8);
  } finally {
    invalidateHsReferenceCache();
  }
});

test("a 4-digit code is completed only when the book has exactly one full code under it", () => {
  const done = completeHsCode("1601", BOOK);
  assert.equal(done.display, "1601.0000");
  assert.ok(done.completed);
  assert.ok(!done.incomplete);
  const two = completeHsCode("1006", [
    ...BOOK,
    row("1006.1000", "Rice in the husk"),
  ]);
  assert.equal(two.display, "1006");
  assert.ok(two.incomplete, "several sub-codes: nothing is guessed");
});

/* ---------------------------------- the gate ------------------------------- */

function first(hsCode: string, extra: Partial<FirstPass> = {}): FirstPass {
  return {
    isImportItem: true,
    hsCode,
    category: "food",
    cleanDescription: "Rice flour",
    confidence: 0.9,
    ...extra,
  };
}

test("gate: an implausible first answer becomes the placeholder so the web step runs", () => {
  const out = gateFirstPass(first("8541.4200"), { texts: ["Rice Flour"] });
  assert.ok(out.rejected);
  assert.equal(out.rejected?.hsCode, "8541.4200");
  assert.ok(out.first.hsCode.startsWith("9999"));
  assert.ok((out.first.confidence ?? 1) <= 0.3);
  const ok = gateFirstPass(first("1102.9000"), { texts: ["Rice Flour"] });
  assert.equal(ok.rejected, undefined);
  assert.equal(ok.first.hsCode, "1102.9000");
});

function step(hsCode: string): StepResult {
  return {
    isImportItem: true,
    hsCode,
    category: "food",
    cleanDescription: "Rice flour",
    confidence: 0.9,
    review: { required: false, confidenceNote: "High", alternatives: [] } as unknown as StepResult["review"],
  };
}

test("gate: a final answer that does not fit is never accepted silently", () => {
  setHsReferenceCache(BOOK);
  try {
    const out = gateStepResult(step("8703.1020"), { texts: ["Rice Flour"] });
    assert.ok(out.hsCode.startsWith("9999"));
    assert.equal(out.review.required, true);
    assert.equal(out.review.rejectedCode?.hsCode, "8703.1020");
  } finally {
    invalidateHsReferenceCache();
  }
});

test("gate: the supplier's code is offered as an option, then filled for expert review", () => {
  setHsReferenceCache(BOOK);
  try {
    const sup = supplierOption("1102.90.00");
    assert.equal(sup?.hsCode, "1102.9000");
    assert.equal(sup?.origin, "supplier");
    assert.equal(supplierOption("2103"), null, "a heading with several sub-codes is not guessed");
    assert.equal(supplierOption("1601")?.hsCode, "1601.0000", "a heading with exactly one full code is completed");

    const out = gateStepResult(step("8703.1020"), {
      texts: ["Rice Flour"],
      supplierHsCode: "11029000",
    });
    // Best book alternative is filled so the row is not "Not classified"; still needs review.
    assert.equal(out.hsCode, "1102.9000");
    assert.equal(out.review.required, true);
    assert.ok(out.review.alternatives.some((a) => a.origin === "supplier"));
    assert.equal(out.review.decisionRequired, true);
    assert.ok((out.confidence ?? 1) <= 0.45);
  } finally {
    invalidateHsReferenceCache();
  }
});

test("gate: placeholder + book alternatives promotes best into HS with review flags", () => {
  setHsReferenceCache(BOOK);
  try {
    const base = step("9999");
    const out = gateStepResult(
      {
        ...base,
        confidence: 0.3,
        review: {
          ...base.review,
          required: true,
          confidenceNote: "No code suggested - 2 options to choose from",
          alternatives: [
            {
              hsCode: "1102.9000",
              officialDescription: "Cereal flours other than of wheat",
              reason: "rice flour",
              inTariffBook: true,
            },
            {
              hsCode: "1006.3000",
              officialDescription: "Semi-milled or wholly milled rice",
              reason: "if it is rice grain",
              inTariffBook: true,
            },
          ],
        },
      },
      { texts: ["Rice Flour"] },
    );
    assert.equal(out.hsCode, "1102.9000");
    assert.equal(out.review.required, true);
    assert.equal(out.review.decisionRequired, true);
    assert.ok((out.confidence ?? 1) <= 0.45);
    assert.match(out.review.confidenceNote ?? "", /Best option filled/i);
    assert.deepEqual(
      out.review.alternatives.map((a) => a.hsCode),
      ["1102.9000", "1006.3000"],
    );
  } finally {
    invalidateHsReferenceCache();
  }
});

/* ------------------------- code and duty normalisation --------------------- */

test("one code format: XXXX.XXXX, short codes flagged incomplete", () => {
  assert.deepEqual(
    [formatHsCode("1601.00.00").display, formatHsCode("16010000").display, formatHsCode("1601.0000").display],
    ["1601.0000", "1601.0000", "1601.0000"],
  );
  assert.equal(formatHsCode("1601.0000").incomplete, false);
  assert.equal(formatHsCode("1601").incomplete, true);
  assert.equal(formatHsCode("1601.10").display, "1601.10");
  assert.equal(formatHsCode("1601.10").incomplete, true);
  assert.equal(exportHsCode("1601"), "1601 (incomplete)");
  assert.equal(exportHsCode("1601.00.00"), "1601.0000");
  assert.equal(exportHsCode(""), "");
});

test("duty rate is always a percent with %, Free stays Free", () => {
  assert.equal(normalizeDutyRate("30%").display, "30%");
  assert.equal(normalizeDutyRate("0.35").display, "35%");
  assert.equal(normalizeDutyRate("0.15").display, "15%");
  assert.equal(normalizeDutyRate("20").display, "20%");
  assert.equal(normalizeDutyRate(" 5.5 % ").display, "5.5%");
  assert.equal(normalizeDutyRate("Free").display, "Free");
  assert.equal(normalizeDutyRate("free").percent, 0);
  assert.equal(normalizeDutyRate("0").display, "0%");
  assert.equal(normalizeDutyRate("").display, "");
  assert.equal(normalizeDutyRate(null).percent, null);
  assert.equal(normalizeDutyRate("5% + 10 USD/kg").display, "", "not a plain rate: left to the caller");
});

test("duty rate: stored value and display value agree", () => {
  assert.equal(parseDutyRate("0.35"), "35.0000");
  assert.equal(parseDutyRate("30%"), "30.0000");
  assert.equal(parseDutyRate("Free"), "0.0000");
  assert.equal(formatDutyRateFromSnapshot({ customsDutyRate: "35.0000" }), "35%");
  assert.equal(formatDutyRateFromSnapshot({ customsDutyRate: "0.0000" }), "0%");
  assert.equal(
    formatDutyRateFromSnapshot({ customsDutyRate: "15", otherCharges: { dutyRateDisplay: "0.15" } }),
    "15%",
  );
  assert.equal(
    formatDutyRateFromSnapshot({ customsDutyRate: null, otherCharges: { dutyRateDisplay: "Free" } }),
    "Free",
  );
  assert.equal(formatDutyRateFromSnapshot(null), null);
});

/* ------------------------------ every product ------------------------------ */

function product(seq: number, status: string, name = `Product ${seq}`) {
  return {
    id: `p${seq}`,
    productSequence: seq,
    status,
    productName: name,
    normalizedDescription: null,
    rawDescription: name,
    quantity: "2",
    unitOfMeasure: "PCS",
  };
}

test("included-all guarantee: every product is either in a group or in the unclassified list", () => {
  const products = [
    product(1, "approved_for_declaration"),
    product(2, "approved_for_declaration"),
    product(3, "hs_suggested"), // has a final classification but is not approved
    product(4, "ready_for_hs_suggestion"), // no classification at all
    product(5, "needs_expert_review"), // placeholder only
  ];
  const grouped = new Set(["p1", "p2"]);
  const codes = new Map<string, string | null>([
    ["p1", "1102.9000"],
    ["p2", "1006.3000"],
    ["p3", "2103.1000"],
    ["p5", "9999.9999"],
  ]);
  const out = findUnclassifiedProducts(products, grouped, codes);
  assert.deepEqual(out.map((u) => u.sequence), [3, 4, 5]);
  assert.equal(out.length + grouped.size, products.length);
  assert.equal(out[0].hsCode, "2103.1000");
  assert.ok(out[0].reason.includes("not approved"));
  assert.equal(out[1].hsCode, null);
  assert.equal(out[1].reason, "No HS code yet");
  assert.equal(out[2].hsCode, null, "a placeholder is not shown as a code");
  assert.ok(out[2].reason.includes("No usable"));
});

test("an approved product missing from the groups says to run grouping again", () => {
  const out = findUnclassifiedProducts(
    [product(7, "approved_for_declaration")],
    new Set(),
    new Map([["p7", "1102.9000"]]),
  );
  assert.ok(out[0].reason.includes("run grouping again"));
});

/* ---------------------------------- origin --------------------------------- */

test("origin: product, invoice, packing, then the case; 'UNK' is never real data", () => {
  assert.equal(resolveProductOrigin({ productOrigin: "cn" }), "CN");
  assert.equal(resolveProductOrigin({ productOrigin: null, invoiceOrigins: [null, "VN"] }), "VN");
  assert.equal(resolveProductOrigin({ productOrigin: "UNK", packingOrigins: ["TH"] }), "TH");
  assert.equal(resolveProductOrigin({ caseOrigin: "IN" }), "IN");
  assert.equal(
    resolveProductOrigin({ productOrigin: "CN", invoiceOrigins: ["VN"], caseOrigin: "IN" }),
    "CN",
    "the product's own origin wins",
  );
  assert.equal(resolveProductOrigin({}), null);
});

test("origin: case fallback is origin, then country of export, then supplier country", () => {
  assert.equal(caseOriginFallback({ countryOfOriginCode: "CN", countryOfExportCode: "HK" }), "CN");
  assert.equal(caseOriginFallback({ countryOfExportCode: "HK", supplierCountryCode: "CN" }), "HK");
  assert.equal(caseOriginFallback({ supplierCountryCode: "CN" }), "CN");
  assert.equal(caseOriginFallback({}), null);
  assert.equal(caseOriginFallback(null), null);
});

test("origin: nothing stored shows 'Not provided', not 'UNK'", () => {
  assert.equal(displayOrigin(null), ORIGIN_NOT_PROVIDED);
  assert.equal(displayOrigin("UNK"), ORIGIN_NOT_PROVIDED);
  assert.equal(displayOrigin("cn"), "CN");
});

/* ------------------------------------ CSV ---------------------------------- */

function fakeGroup(): GroupingWithProducts {
  const p = {
    id: "p1",
    productSequence: 1,
    normalizedDescription: "Rice flour",
    rawDescription: "Rice flour",
    quantity: "10",
    unitOfMeasure: "KG",
    countryOfOriginCode: null,
    brand: null,
    modelNumber: null,
  };
  return {
    grouping: {
      groupCode: "GRP-001",
      hsCode: "1102.9000",
      countryOfOriginCode: "UNK",
      procedureCode: "IM4",
      unitOfMeasure: "KG",
      groupingReason: "1 product(s)",
    },
    products: [
      {
        product: p,
        classification: { hsCode: "1102.9000" },
        tariffSnapshot: { customsDutyRate: "0.3500", hsCode: "1102.9000", otherCharges: { dutyRateDisplay: "0.35" } },
      },
    ],
    totalQuantity: 10,
  } as unknown as GroupingWithProducts;
}

test("origin fill: an old 'UNK' group takes the real origin from the invoice line or the case", () => {
  const g = fakeGroup();
  const origins = {
    caseOrigin: "CN",
    byProduct: new Map([["p1", { invoice: ["VN"], packing: [] as string[] }]]),
  };
  assert.equal(exportGroupOrigin(g, origins), "VN");
  assert.equal(exportGroupOrigin(g, { caseOrigin: "CN", byProduct: new Map() }), "CN");
  assert.equal(exportGroupOrigin(g, { caseOrigin: null, byProduct: new Map() }), ORIGIN_NOT_PROVIDED);
  assert.equal(exportProductOrigin(g.products[0].product, undefined), ORIGIN_NOT_PROVIDED);
});

test("export CSV: unclassified section, one code format, % duty, 'Not provided' origin", () => {
  const unclassified = findUnclassifiedProducts(
    [product(9, "hs_suggested", "Loose item")],
    new Set(),
    new Map([["p9", "2103.1000"]]),
  );
  const csv = generateDeclarationCsv("IMP-TEST", [fakeGroup()], {
    unclassified,
    origins: { caseOrigin: null, byProduct: new Map() },
  }).toString("utf-8");
  assert.ok(csv.includes("# UNCLASSIFIED - 1 product(s)"), "marked section");
  assert.ok(csv.includes("Loose item"));
  assert.ok(csv.includes("2103.1000"));
  assert.ok(csv.includes("Products: 2 in total, 1 in 1 group(s), 1 unclassified"));
  assert.ok(csv.includes("35%"), "fraction becomes a percent");
  assert.ok(!csv.includes("0.35"), "no raw fraction left");
  assert.ok(csv.includes(Not_provided()), "origin placeholder");
  assert.ok(!/\bUNK\b/.test(csv), "no UNK");
});

function Not_provided() {
  return ORIGIN_NOT_PROVIDED;
}

test("export CSV without unclassified products has no empty marked section", () => {
  const csv = generateDeclarationCsv("IMP-TEST", [fakeGroup()]).toString("utf-8");
  assert.ok(!csv.includes("UNCLASSIFIED"));
});

Promise.all(pending).then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});