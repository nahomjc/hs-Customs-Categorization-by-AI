/**
 * Regression bank for the word check ("keyword plausibility") and how it is used:
 *
 *  - a bank of tricky product names with the kind of product the check should name
 *    (or null = no opinion) and what that means for a code in a fitting / other chapter;
 *  - a word-check warning only flags: the code is kept and offered, never replaced by
 *    "No code suggested";
 *  - the short AI judgement (mocked) decides whether the warning stays, and any failure
 *    keeps the code and the warning;
 *  - the card text names the word and says it is only a warning.
 *
 * No database, no network, no live AI.
 *
 *   npm run test:hs-keyword-bank
 */
import "./stub-server-only";
import assert from "node:assert/strict";
import type { AiCallResult, AiMessage } from "../lib/ai-json";
import { blocksApproval, checkPlausibility } from "../lib/hs-plausibility";
import { productFamily } from "../lib/hsProductChapter";
import { invalidateHsReferenceCache, setHsReferenceCache, type HsReferenceCacheRow } from "../lib/hsReferenceCache";
import type { StepResult } from "../lib/import-cases/hs-web-step";
import {
  JUDGE_BUDGET_MS,
  judgeKeywordConflict,
  judgeKeywordConflicts,
  keywordClearedByAi,
  type JudgeCall,
} from "../lib/import-cases/keyword-judge";
import { gateFirstPass, gateStepResult } from "../lib/import-cases/plausibility-gate";

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
  pending.push(pending.length === 0 ? run() : pending[pending.length - 1].then(run));
}

/* ------------------------------- the name bank ------------------------------ */

/** A code that fits each kind of product, and one that clearly does not. */
const FITS: Record<string, string> = {
  food: "2103.9000",
  kitchenware: "7323.9300",
  lighting: "9405.4100",
  incense: "3307.4100",
  ceramic: "6912.0000",
  apparel: "6109.1000",
  textileMaterial: "5208.1100",
  artificialPlant: "6702.1000",
  wallpaper: "4814.2000",
  fan: "8414.5100",
  insulation: "7019.1100",
  textile: "6302.6000",
};
const OTHER = "8703.1020";

/** name -> kind of product the word check should name (null = no opinion, no warning). */
const BANK: Array<[string, string | null]> = [
  // food phrases with a kitchen / vessel word
  ["Pot noodle", "food"],
  ["Cup noodle", "food"],
  ["Instant cup noodles", "food"],
  ["Tea bag", "food"],
  ["Canned tuna", "food"],
  ["Hot pot sauce", "food"],
  ["Spicy hot pot base sauce", "food"],
  ["Hot pot dipping sauce", "food"],
  ["Hot pot seasoning", "food"],
  ["Soup base", "food"],
  ["Spoon-shaped candy", "food"],
  ["Pan-fried noodle seasoning", "food"],
  ["Steamer bun mix", "food"],
  ["Mug cake mix", "food"],
  ["Chicken pot pie", "food"],
  ["Light soy sauce", "food"],
  ["Chili oil", "food"],
  ["Cooking oil", "food"],
  ["Rice flour", "food"],
  // objects named after a food: the object is what is imported (no opinion)
  ["Wine glass", null],
  ["Wine bottle", null],
  ["Jam jar", null],
  ["Noodle bowl", null],
  ["Rice mill machine", null],
  ["Tea Table", null],
  ["Coffee table", null],
  ["Bottle water", null],
  ["Water bottle", null],
  // other look-alikes
  ["Glass cleaner", null],
  ["Fork lift truck part", null],
  ["Pan flute", null],
  ["Pot plant", null],
  ["Instant hot pot", null],
  // real kitchenware
  ["Non-stick iron pot", "kitchenware"],
  ["Iron wok", "kitchenware"],
  ["Frying pan", "kitchenware"],
  ["Tea set", "kitchenware"],
  ["Tea cup", "kitchenware"],
  ["Tea tray", "kitchenware"],
  ["Coffee cup", "kitchenware"],
  ["Soup spoon", "kitchenware"],
  ["Butter knife", "kitchenware"],
  ["Knife sharpener", "kitchenware"],
  ["Bamboo steamer", "kitchenware"],
  ["Rice cooker", "kitchenware"],
  ["Electric hot pot", "kitchenware"],
  ["Stainless steel hot pot", "kitchenware"],
  ["Chopsticks", "kitchenware"],
  ["Thermos flask", "kitchenware"],
  // other kinds of product
  ["Oil lamp", "lighting"],
  ["LED strip light", "lighting"],
  ["Desk lamp", "lighting"],
  ["Scented candle", "incense"],
  ["Liquid incense used for fragrance and aromatherapy.", "incense"],
  ["Ceramic mug", "ceramic"],
  ["Cotton t-shirt", "apparel"],
  ["Denim jeans", "apparel"],
  ["Cotton fabric", "textileMaterial"],
  ["Artificial plant", "artificialPlant"],
  ["Wallpaper", "wallpaper"],
  ["Extract fan", "fan"],
  ["Fiberglass insulation", "insulation"],
  ["Bath towel", "textile"],
];

for (const [name, kind] of BANK) {
  test(`"${name}" -> ${kind ?? "no opinion"}`, () => {
    const fam = productFamily(name);
    assert.equal(fam?.id ?? null, kind, `family was ${fam?.id ?? "none"} (word: ${fam?.trigger ?? "-"})`);
    if (kind === null) {
      // no opinion: any code is accepted by the word check
      assert.equal(checkPlausibility({ hsCode: OTHER, texts: [name] }).status, "ok");
      return;
    }
    assert.ok(FITS[kind], `bank has a fitting code for ${kind}`);
    assert.equal(checkPlausibility({ hsCode: FITS[kind], texts: [name] }).status, "ok", "fitting chapter is fine");
    const bad = checkPlausibility({ hsCode: OTHER, texts: [name] });
    assert.equal(bad.status, "implausible", "another chapter is only a warning");
    assert.ok(bad.trigger, "the exact word is named");
  });
}

/* ------------------------- a warning flags, never drops ---------------------- */

function row(hsCode: string, description: string): HsReferenceCacheRow {
  return { heading: hsCode.slice(0, 4), hsCode, normalizedHs: hsCode, tariffNo: hsCode, description, stdUnit: "kg", dutyRate: "20", chapter: hsCode.slice(0, 2) };
}
setHsReferenceCache([
  row("2103.9000", "- Other sauces and preparations therefor; mixed condiments and mixed seasonings"),
  row("7323.9300", "- - Of stainless steel: table, kitchen or other household articles"),
  row("8703.1020", "- Vehicles"),
]);

function step(hsCode: string, over: Partial<StepResult["review"]> = {}): StepResult {
  return {
    isImportItem: true,
    hsCode,
    category: "x",
    cleanDescription: "x",
    confidence: 0.85,
    review: { required: false, confidenceNote: "High (85%) - 3 web sources; found in the tariff book", alternatives: [], web: { attempted: true, used: true, sources: [] }, ...over } as StepResult["review"],
  };
}

test("a real iron pot with a sauce code: the code is kept, flagged, and the card names the word", () => {
  const out = gateStepResult(step("2103.9000"), { texts: ["Non-stick iron pot"] });
  assert.equal(out.hsCode, "2103.9000");
  assert.equal(out.review.required, true);
  assert.notEqual(out.review.confidenceNote, "No code suggested");
  assert.equal(out.review.keywordWarning?.word, "pot");
  assert.equal(out.review.keywordWarning?.looksLike, "kitchenware");
  const text = out.review.reason ?? "";
  assert.match(text, /We saw "pot" in the name/);
  assert.match(text, /kitchenware/);
  assert.match(text, /only a warning/);
  assert.doesNotMatch(text, /implausib|plausib|undefined|null|\{|\}|rejected|dropped/i);
  assert.equal(out.review.rejectedCode, undefined);
});

test("a flagged code is offered next to the other options, and a question is asked", () => {
  const out = gateStepResult(
    step("2103.9000", {
      alternatives: [{ hsCode: "7323.9300", officialDescription: "household articles", inTariffBook: true }],
    }),
    { texts: ["Non-stick iron pot"] },
  );
  assert.equal(out.hsCode, "2103.9000");
  assert.equal(out.review.decisionRequired, true);
  assert.deepEqual(out.review.alternatives.map((a) => a.hsCode), ["7323.9300"]);
  assert.match(out.review.question ?? "", /2103\.9000/);
});

test("options with a warning stay, behind the ones without", () => {
  const out = gateStepResult(
    step("7323.9300", {
      alternatives: [
        { hsCode: "8703.1020", officialDescription: "vehicles", inTariffBook: true },
        { hsCode: "7323.9300", officialDescription: "household", inTariffBook: true },
      ],
    }),
    { texts: ["Non-stick iron pot"] },
  );
  assert.deepEqual(out.review.alternatives.map((a) => a.hsCode), ["7323.9300", "8703.1020"]);
});

test("a first answer with a warning is kept (confidence capped), not blanked", () => {
  const out = gateFirstPass(
    { isImportItem: true, hsCode: "2103.9000", category: "x", cleanDescription: "Iron pot", confidence: 0.9 },
    { texts: ["Non-stick iron pot"] },
  );
  assert.equal(out.first.hsCode, "2103.9000");
  assert.ok((out.first.confidence ?? 1) <= 0.3);
  assert.equal(out.rejected, undefined);
});

test("a catch-all is still hard-rejected (never offered as a real code)", () => {
  const out = gateStepResult(step("9999"), { texts: ["Non-stick iron pot"] });
  assert.match(out.hsCode, /^9999/);
  assert.equal(out.review.keywordWarning, undefined);
});

test("one-by-one approval is never blocked by a word check; bulk approval is", () => {
  const v = checkPlausibility({ hsCode: "2103.9000", texts: ["Non-stick iron pot"] });
  assert.equal(v.status, "implausible");
  assert.equal(blocksApproval(v), false);
  assert.equal(blocksApproval(v, { bulk: true }), true);
});

/* --------------------------- the short AI judgement --------------------------- */

const sentinel: { calls: Array<{ messages: AiMessage[]; maxTokens: number; timeoutMs: number }> } = { calls: [] };
function scripted(replies: Array<AiCallResult | Error>): JudgeCall {
  sentinel.calls = [];
  return async (messages, maxTokens, timeoutMs) => {
    sentinel.calls.push({ messages, maxTokens, timeoutMs });
    const r = replies[Math.min(sentinel.calls.length - 1, replies.length - 1)];
    if (r instanceof Error) throw r;
    return r;
  };
}
const INPUT = {
  name: "Iron pot sauce set",
  description: "Iron pot sauce set with ladle, for dipping",
  hsCode: "2103.9000",
  codeText: "Other sauces",
  word: "pot",
  looksLike: "kitchenware",
};

test("judge: 'code_type' means the code fits", async () => {
  const call = scripted([{ content: '{"productType":"code_type","reason":"It is a sauce, not a pot."}', finishReason: "stop" }]);
  const r = await judgeKeywordConflict(INPUT, { call });
  assert.equal(r.result, "fits");
  assert.equal(r.note, "It is a sauce, not a pot.");
  const prompt = sentinel.calls[0].messages.map((m) => m.content).join("\n");
  assert.match(prompt, /Full description: Iron pot sauce set with ladle/);
  assert.match(prompt, /"pot"/);
  assert.match(prompt, /2103\.9000/);
  assert.ok(sentinel.calls[0].maxTokens <= 150, "small answer");
  assert.ok(sentinel.calls[0].timeoutMs <= JUDGE_BUDGET_MS, "short timeout");
});
test("judge: 'keyword_type' means the word is right", async () => {
  const call = scripted([{ content: '{"productType":"keyword_type","reason":"A cooking pot."}', finishReason: "stop" }]);
  assert.equal((await judgeKeywordConflict(INPUT, { call })).result, "conflict");
});
test("judge: unsure / garbage / API error / time out -> no verdict, never throws", async () => {
  assert.equal((await judgeKeywordConflict(INPUT, { call: scripted([{ content: '{"productType":"unsure"}' }]) })).result, "unsure");
  assert.equal((await judgeKeywordConflict(INPUT, { call: scripted([{ content: "no idea", finishReason: "stop" }]) })).result, "unavailable");
  assert.equal((await judgeKeywordConflict(INPUT, { call: scripted([new Error("OpenRouter API error: 429")]) })).result, "unavailable");
  let t = 0;
  const slow = await judgeKeywordConflict(INPUT, { call: scripted([{ content: "{" }]), budgetMs: 8000, now: () => (t += 7000) });
  assert.equal(slow.result, "unavailable");
});
test("judge: a cut-off answer gets the one stricter retry (same robust JSON handling)", async () => {
  const call = scripted([
    { content: '{"productType":"code_ty', finishReason: "length" },
    { content: '{"productType":"code_type","reason":"Sauce."}', finishReason: "stop" },
  ]);
  const r = await judgeKeywordConflict(INPUT, { call });
  assert.equal(r.result, "fits");
  assert.equal(sentinel.calls.length, 2);
});
test("judges only codes that have a warning, at most two, and keeps nothing", async () => {
  const call = scripted([{ content: '{"productType":"code_type","reason":"ok"}' }]);
  const ctx = { texts: ["Non-stick iron pot"], description: "Non-stick iron pot" };
  const none = await judgeKeywordConflicts(["7323.9300"], ctx, { call });
  assert.deepEqual(none, {});
  assert.equal(sentinel.calls.length, 0, "no warning, no AI call");
  const some = await judgeKeywordConflicts(["2103.9000", "8703.1020", "2103.9000"], ctx, { call, max: 2 });
  assert.deepEqual(Object.keys(some).sort(), ["21039000", "87031020"]);
  assert.equal(sentinel.calls.length, 2);
});

test("gate: AI says the code fits -> no warning on the card, recorded so it is not raised again", () => {
  const judged = { "21039000": { result: "fits" as const, note: "It is a sauce." } };
  const out = gateStepResult(step("2103.9000"), { texts: ["Non-stick iron pot"], judged });
  assert.equal(out.review.required, false);
  assert.equal(out.review.keywordWarning, undefined);
  assert.equal(out.review.keywordCleared?.word, "pot");
  assert.equal(keywordClearedByAi({ review: out.review }), true);
  assert.equal(checkPlausibility({ hsCode: "2103.9000", texts: ["Non-stick iron pot"], keywordClearedByAi: true }).status, "ok");
  assert.equal(keywordClearedByAi({ review: {} }), false);
  assert.equal(keywordClearedByAi(null), false);
});
test("gate: AI agrees with the word -> warning stays, the AI view is on the card, code kept", () => {
  const judged = { "21039000": { result: "conflict" as const, note: "A cooking pot." } };
  const out = gateStepResult(step("2103.9000"), { texts: ["Non-stick iron pot"], judged });
  assert.equal(out.hsCode, "2103.9000");
  assert.equal(out.review.required, true);
  assert.equal(out.review.keywordWarning?.judgement, "agrees");
  assert.match(out.review.reason ?? "", /quick AI check of the full description also thought so: A cooking pot\./);
});
test("gate: AI unsure or unavailable -> warning stays and the code is kept", () => {
  for (const result of ["unsure", "unavailable"] as const) {
    const out = gateStepResult(step("2103.9000"), { texts: ["Non-stick iron pot"], judged: { "21039000": { result } } });
    assert.equal(out.hsCode, "2103.9000");
    assert.equal(out.review.required, true);
    assert.match(out.review.reason ?? "", /only a warning/);
    assert.equal(out.review.keywordWarning?.judgement, result);
  }
});
test("the hot-pot names with 2103.9000 need no AI call and no warning", async () => {
  const call = scripted([{ content: "{}" }]);
  for (const name of ["Spicy hot pot base sauce", "Hot pot sauce", "Hot pot dipping sauce"]) {
    const out = gateStepResult(step("2103.9000"), { texts: [name] });
    assert.equal(out.review.required, false);
    assert.equal(out.review.keywordWarning, undefined);
    assert.deepEqual(await judgeKeywordConflicts(["2103.9000"], { texts: [name], description: name }, { call }), {});
  }
  assert.equal(sentinel.calls.length, 0);
});

void Promise.all(pending).then(() => {
  invalidateHsReferenceCache();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});