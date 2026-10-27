/**
 * Offline test for tariff-book ties: the rice case (four rice rows, a bare
 * "Rice", the invoice code 1006.4000), the invoice code as a HINT only (ignored
 * when it does not fit, shown next to the suggestion when plausible but
 * different), and VDD history for an exact product name as a top option that
 * never overrides an unambiguous tariff match. No database, no network.
 *
 *   npm run test:hs-ties
 */
import "./stub-server-only";
import assert from "node:assert/strict";
import { classifyFromReferenceDescription, type ReferenceClassificationMeta } from "../lib/classifyFromReference";
import { checkPlausibility } from "../lib/hs-plausibility";
import { invalidateHsReferenceCache, setHsReferenceCache, type HsReferenceCacheRow } from "../lib/hsReferenceCache";
import {
  applyVddNameOption,
  buildSupplierBreakReview,
  buildSupplierDifferenceReview,
  buildTieReview,
  vddOption,
} from "../lib/import-cases/tie-options";
import type { StepResult } from "../lib/import-cases/hs-web-step";
import { exactNameVddConsensus } from "../lib/vdd/search-matches";
import type { VddScoredMatch } from "../lib/vdd/score-match";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (error) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(error as Error).message}`);
  }
}

function row(hsCode: string, description: string): HsReferenceCacheRow {
  return {
    heading: hsCode.slice(0, 4),
    hsCode,
    normalizedHs: hsCode,
    tariffNo: hsCode,
    description,
    stdUnit: "kg",
    dutyRate: "5",
    chapter: hsCode.slice(0, 2),
  };
}

setHsReferenceCache([
  row("1006.1000", "- Rice in the husk (paddy or rough)"),
  row("1006.2000", "- Husked (brown) rice"),
  row("1006.3000", "- Semi-milled or wholly milled rice, whether or not polished or glazed"),
  row("1006.4000", "- Broken rice"),
  row("8703.2100", "- - Of a cylinder capacity not exceeding 1,000 cc"),
  row("0902.1000", "- Green tea (not fermented) in immediate packings"),
]);

function ref(description: string, supplierHsCode: string | null) {
  const r = classifyFromReferenceDescription(description, { supplierHsCode });
  assert.ok(r, "a tariff match");
  return { result: r, meta: JSON.parse(r.aiRawResponse) as ReferenceClassificationMeta };
}

function vddMatch(commonName: string, commercial: string, hsCode: string): VddScoredMatch {
  return {
    record: { commonName, commercialDescription: commercial, hsCode },
    similarity: 0.5,
  } as unknown as VddScoredMatch;
}

const TEXTS = ["Rice"];

// ---- the rice case --------------------------------------------------------
test("rice: the invoice code 10064000 breaks the tie between four rice rows -> 1006.4000", () => {
  const { result, meta } = ref("Rice", "10064000");
  assert.equal(result.hsCode, "1006.4000");
  assert.equal(meta.tied, undefined);
  assert.equal(meta.supplierBreak, true);
});

test("rice: the tie-break is flagged for confirmation, not silently accepted", () => {
  const review = buildSupplierBreakReview("1006.4000", { texts: TEXTS, label: "Rice" });
  assert.equal(review.required, true);
  assert.match(review.reason ?? "", /invoice code/i);
  assert.match(review.reason ?? "", /confirm/i);
});

test("rice: without an invoice code the four rows are a tie, none is picked", () => {
  const { meta } = ref("Rice", null);
  assert.equal(meta.tied?.length, 4);
  const tie = buildTieReview(meta.tied!, { texts: TEXTS, label: "Rice" });
  assert.match(tie.hsCode, /^9999/);
  assert.equal(tie.review.decisionRequired, true);
  assert.equal(tie.review.alternatives.length, 4);
  assert.match(tie.review.question ?? "", /Rice/);
});

test("'Broken rice' is a real row (not zeroed by the short-row rule)", () => {
  const { result } = ref("Broken rice", null);
  assert.equal(result.hsCode, "1006.4000");
});

test("a more specific name beats the invoice code (not a tie)", () => {
  const { result } = ref("Husked rice", "10063000");
  assert.equal(result.hsCode, "1006.2000");
});

// ---- the invoice code is a hint ------------------------------------------
test("wrong-chapter invoice code is ignored: tie options carry no invoice option", () => {
  const { meta } = ref("Rice", "87032100");
  assert.ok(meta.supplierIgnored, "ignored with a reason");
  assert.equal(meta.supplierHsCode, undefined);
  assert.equal(meta.tied?.length, 4);
  const tie = buildTieReview(meta.tied!, { texts: TEXTS, label: "Rice", supplierHsCode: meta.supplierHsCode });
  assert.ok(tie.review.alternatives.every((a) => a.origin !== "supplier"));
  assert.ok(!tie.review.alternatives.some((a) => a.hsCode.startsWith("8703")));
});

test("plausible but different invoice code: suggestion kept, both shown, one question", () => {
  const { result, meta } = ref("Husked rice", "10063000");
  assert.equal(result.hsCode, "1006.2000");
  assert.ok(meta.supplierCheck, "flagged");
  assert.equal(meta.supplierCheck?.level, "subheading");
  const review = buildSupplierDifferenceReview(result.hsCode, meta.supplierCheck!, {
    texts: ["Husked rice"],
    label: "Husked rice",
    supplierHsCode: meta.supplierHsCode,
  });
  assert.equal(review.required, true);
  assert.equal(review.decisionRequired, true);
  assert.equal(review.alternatives.length, 1);
  assert.equal(review.alternatives[0].hsCode, "1006.3000");
  assert.equal(review.alternatives[0].origin, "supplier");
  assert.match(review.question ?? "", /1006\.2000/);
});

test("description clearly supports the suggestion: the invoice code does not flag it", () => {
  const { result, meta } = ref("Broken rice", "10061000");
  assert.equal(result.hsCode, "1006.4000");
  assert.equal(meta.supplierCheck, undefined);
});

test("tie options: the row that matches the invoice code is marked", () => {
  const { meta } = ref("Rice", null);
  const tie = buildTieReview(meta.tied!, { texts: TEXTS, label: "Rice", supplierHsCode: "10063000" });
  assert.equal(tie.review.alternatives[0].hsCode, "1006.3000");
  assert.match(tie.review.alternatives[0].reason ?? "", /matches your invoice code/i);
});

test("plausibility: same heading, different sub-heading is 'check'; a human decision silences it", () => {
  const input = { hsCode: "1006.2000", texts: ["Rice"], supplierHsCode: "10063000" };
  const v = checkPlausibility(input);
  assert.equal(v.status, "check");
  assert.equal(v.level, "subheading");
  assert.equal(checkPlausibility({ ...input, decidedByHuman: true }).status, "ok");
  assert.equal(checkPlausibility({ ...input, supplierHsCode: "10062000" }).status, "ok");
});

// ---- VDD history for the exact name --------------------------------------
test("VDD exact name: 'Rice' agrees on one code; a look-alike name does not count", () => {
  const rows = [
    vddMatch("Broken Rice", "Rice", "10064000"),
    vddMatch("Eight Treasure Rice", "Eight Treasure Rice", "10064000"),
  ];
  const c = exactNameVddConsensus(rows, ["Rice"]);
  assert.equal(c?.digits, "10064000");
  assert.equal(c?.count, 1);
  assert.equal(exactNameVddConsensus([rows[1]], ["Rice"]), null);
});

test("VDD exact name: records that disagree give no suggestion", () => {
  const rows = [vddMatch("Rice", "Rice", "10064000"), vddMatch("Rice", "Rice", "10063000")];
  assert.equal(exactNameVddConsensus(rows, ["Rice"]), null);
});

test("VDD on a tie: its code is the top option, nothing is final", () => {
  const { meta } = ref("Rice", null);
  const vdd = exactNameVddConsensus([vddMatch("Broken Rice", "Rice", "10064000")], ["Rice"]);
  const tie = buildTieReview(meta.tied!, { texts: TEXTS, label: "Rice", vdd });
  assert.match(tie.hsCode, /^9999/);
  assert.equal(tie.review.alternatives[0].hsCode, "1006.4000");
  assert.equal(tie.review.alternatives[0].origin, "vdd");
  assert.equal(tie.review.decisionRequired, true);
});

test("VDD never overrides an unambiguous tariff match (no review added on that path)", () => {
  const { result, meta } = ref("Broken rice", null);
  assert.equal(result.hsCode, "1006.4000");
  assert.equal(meta.tied, undefined);
  assert.equal(meta.supplierCheck, undefined);
  assert.equal(meta.supplierBreak, undefined);
});

test("VDD on an AI answer: offered as top option, the AI suggestion stays, a person decides", () => {
  const step: StepResult = {
    isImportItem: true,
    hsCode: "1006.3000",
    category: "Cereals",
    cleanDescription: "Rice",
    confidence: 0.7,
    review: { required: false, reason: "", alternatives: [], web: { attempted: false, used: false, sources: [] } },
  } as unknown as StepResult;
  const vdd = exactNameVddConsensus([vddMatch("Rice", "Rice", "10064000")], ["Rice"]);
  const out = applyVddNameOption(step, vdd, { texts: TEXTS, label: "Rice" });
  assert.equal(out.hsCode, "1006.3000");
  assert.equal(out.review.alternatives[0].hsCode, "1006.4000");
  assert.equal(out.review.alternatives[0].origin, "vdd");
  assert.equal(out.review.required, true);
  assert.equal(out.review.decisionRequired, true);
  // same code: nothing to add
  const same = applyVddNameOption({ ...step, hsCode: "1006.4000" }, vdd, { texts: TEXTS, label: "Rice" });
  assert.equal(same.review.required, false);
});

test("VDD code that does not fit the product is not offered", () => {
  const vdd = exactNameVddConsensus([vddMatch("Rice", "Rice", "87032100")], ["Rice"]);
  assert.equal(vddOption(vdd, { texts: TEXTS }), null);
});

invalidateHsReferenceCache();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);