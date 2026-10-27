/**
 * Offline test for two review-queue bugs:
 *  1. "Hot pot sauce" (chapter 21) was dropped as "kitchenware" because of the word "pot";
 *  2. an AI reply cut off in the middle of its JSON ("Invalid JSON from reasoning AI: {...")
 *     reached the screen. All AI / search answers are mocked. No database, no network.
 *
 *   npm run test:hs-hotpot
 */
import "./stub-server-only";
import assert from "node:assert/strict";
import {
  AiReplyError,
  repairTruncatedJson,
  requestJsonObject,
  type AiCallResult,
} from "../lib/ai-json";
import { checkPlausibility } from "../lib/hs-plausibility";
import { detectProductSignals, productFamily } from "../lib/hsProductChapter";
import { invalidateHsReferenceCache, setHsReferenceCache, type HsReferenceCacheRow } from "../lib/hsReferenceCache";
import { friendlyAiFailure } from "../lib/import-cases/classify-product-description";
import { applyWebSearchStep, type FirstPass, type StepDeps } from "../lib/import-cases/hs-web-step";
import { gateStepResult } from "../lib/import-cases/plausibility-gate";
import type { WebSearchConfig, WebSearchResult } from "../lib/hs-web-search";

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

const kitchenware = (d: string) => detectProductSignals(d).kitchenware;

console.log("food phrases are not kitchenware");
for (const name of [
  "Spicy hot pot base sauce",
  "Hot pot sauce",
  "Hot pot dipping sauce",
  "Hot pot seasoning",
  "Beef hot pot base",
  "Pot noodle",
  "Instant pot noodles",
  "Soup base",
  "Wok seasoning",
  "Stir fry wok sauce",
  "Pan-fried noodle seasoning",
  "Chicken pot pie",
  "Steamer rice noodles",
  "Pot stickers frozen",
]) {
  test(`"${name}" is not kitchenware`, () => {
    assert.equal(kitchenware(name), false);
  });
}

console.log("real kitchenware stays kitchenware");
for (const name of [
  "Non-stick iron pot",
  "Iron wok",
  "Stainless steel pot for cooking soup",
  "Frying pan",
  "Tea set",
  "Ceramic tea cups",
  "Bamboo steamer with lid",
  "Electric hot pot",
  "Electric hot pot with divider and lid",
  "Stainless steel hot pot",
  "Cookware set",
  "Soup spoon",
  "Thermos flask",
  "Set of pot and pan",
]) {
  test(`"${name}" is kitchenware`, () => {
    assert.equal(kitchenware(name), true);
  });
}

console.log("other vessel-like words do not trigger it on food names");
for (const name of ["Instant noodle cup", "Chili sauce bottle 500ml", "Jam jar", "Rice bowl noodles", "Canned tuna", "Rice stove top mix"]) {
  test(`"${name}" is not kitchenware`, () => {
    assert.equal(kitchenware(name), false);
  });
}

console.log("plausibility");
for (const name of ["Spicy hot pot base sauce", "Hot pot sauce", "Hot pot dipping sauce"]) {
  test(`2103.9000 fits "${name}" (chapter 21 sauces)`, () => {
    assert.equal(productFamily(name)?.id, "food");
    const v = checkPlausibility({ hsCode: "2103.9000", texts: [name] });
    assert.notEqual(v.status, "implausible");
    assert.notEqual(v.status, "check");
  });
}
test("a real iron pot is still wrong in chapter 21", () => {
  assert.equal(checkPlausibility({ hsCode: "2103.9000", texts: ["Non-stick iron pot"] }).status, "implausible");
});

console.log("mocked flow: web answer 2103.9000 -> a normal suggestion");
function row(hsCode: string, description: string): HsReferenceCacheRow {
  return { heading: hsCode.slice(0, 4), hsCode, normalizedHs: hsCode, tariffNo: hsCode, description, stdUnit: "kg", dutyRate: "20", chapter: hsCode.slice(0, 2) };
}
const CONFIG: WebSearchConfig = {
  enabled: true, mode: "fallback", model: "openai/gpt-4o-mini", engine: "exa",
  maxResults: 5, timeoutMs: 45_000, maxQueries: 3, budgetMs: 100_000,
};
function first(cleanDescription: string): FirstPass {
  return { isImportItem: true, hsCode: "9999", category: "Prepared foodstuffs", cleanDescription, confidence: 0.2, source: "ai_suggestion" };
}
const search: StepDeps["search"] = async () =>
  ({
    ok: true,
    output: {
      isImportItem: true,
      hsCode: "2103.90",
      confidence: 0.8,
      reasoning: "Mock: sauces and condiments.",
      sources: [{ url: "https://example.org/hot-pot-sauce", title: "Hot pot sauce", fromSearch: true }],
      alternatives: [],
      model: "mock",
    },
  }) as WebSearchResult;

setHsReferenceCache([
  row("2103.9000", "- Other sauces and preparations therefor; mixed condiments and mixed seasonings"),
  row("7323.9300", "- - Of stainless steel: table, kitchen or other household articles"),
]);
for (const name of ["Spicy hot pot base sauce", "Hot pot sauce", "Hot pot dipping sauce"]) {
  test(`"${name}" -> 2103.9000 offered, not "No code suggested"`, async () => {
    const step = await applyWebSearchStep({ description: name, first: first(name) }, { config: CONFIG, search });
    const gated = gateStepResult(step, { texts: [name] });
    assert.equal(gated.hsCode, "2103.9000");
    assert.doesNotMatch(gated.review.reason ?? "", /kitchenware|No clear tariff match/);
    assert.notEqual(gated.review.confidenceNote, "No code suggested");
  });
}

console.log("cut-off AI replies");
const REQUIRED = ["isImportItem", "hsCode", "category", "cleanDescription"];
const CUT = '{"isImportItem":true,"category":"Other","hsCode":"9999","cleanDescription":"Liquid incen';
const FULL = '{"isImportItem":true,"category":"Fragrance","hsCode":"3307.4100","cleanDescription":"Liquid incense"}';
function scripted(replies: AiCallResult[]) {
  const calls: Array<{ system: string; maxTokens: number }> = [];
  const call = async (messages: Array<{ role: string; content: string }>, maxTokens: number) => {
    calls.push({ system: messages[0].content, maxTokens });
    return replies[Math.min(calls.length - 1, replies.length - 1)];
  };
  return { calls, call: call as Parameters<typeof requestJsonObject>[0] };
}
const MSGS = [
  { role: "system" as const, content: "Return ONLY valid JSON." },
  { role: "user" as const, content: "Liquid incense used for fragrance and aromatherapy." },
];

test("valid reply: one call, nothing changes", async () => {
  const s = scripted([{ content: FULL, finishReason: "stop" }]);
  const r = await requestJsonObject<{ hsCode: string }>(s.call, MSGS, { maxTokens: 900, retryMaxTokens: 1800, requiredKeys: REQUIRED });
  assert.equal(r.parsed.hsCode, "3307.4100");
  assert.equal(s.calls.length, 1);
});
test("cut off, then complete: one retry with more room and a stricter instruction", async () => {
  const s = scripted([{ content: CUT, finishReason: "length" }, { content: FULL, finishReason: "stop" }]);
  const r = await requestJsonObject<{ hsCode: string }>(s.call, MSGS, { maxTokens: 900, retryMaxTokens: 1800, requiredKeys: REQUIRED });
  assert.equal(r.parsed.hsCode, "3307.4100");
  assert.equal(s.calls.length, 2);
  assert.equal(s.calls[1].maxTokens, 1800);
  assert.match(s.calls[1].system, /ONE compact JSON object/);
  assert.doesNotMatch(s.calls[0].system, /ONE compact JSON object/);
});
test("cut off twice: a plain error, no raw JSON in it", async () => {
  const s = scripted([{ content: CUT, finishReason: "length" }]);
  await assert.rejects(
    requestJsonObject(s.call, MSGS, { maxTokens: 900, retryMaxTokens: 1800, requiredKeys: REQUIRED }),
    (e: unknown) => {
      assert.ok(e instanceof AiReplyError);
      assert.equal((e as AiReplyError).kind, "cut_off");
      assert.equal((e as Error).message, "The AI reply was cut off; try Ask AI again.");
      assert.doesNotMatch((e as Error).message, /\{|isImportItem|incen/);
      return true;
    },
  );
  assert.equal(s.calls.length, 2, "exactly one retry");
});
test("garbage reply is 'could not be read', not a raw excerpt", async () => {
  const s = scripted([{ content: "Sorry, I cannot do that.", finishReason: "stop" }]);
  await assert.rejects(
    requestJsonObject(s.call, MSGS, { maxTokens: 900, retryMaxTokens: 1800, requiredKeys: REQUIRED }),
    (e: unknown) => e instanceof AiReplyError && (e as AiReplyError).kind === "unreadable" && !/Sorry/.test((e as Error).message),
  );
});
test("repair keeps complete fields only, and only when every required field survives", () => {
  const cutLate = '{"isImportItem":true,"category":"Fragrance","hsCode":"3307.4100","cleanDescription":"Liquid incense","question":"Is it a cand';
  const fixed = repairTruncatedJson<Record<string, unknown>>(cutLate, REQUIRED);
  assert.deepEqual(fixed, { isImportItem: true, category: "Fragrance", hsCode: "3307.4100", cleanDescription: "Liquid incense" });
  assert.equal(repairTruncatedJson(CUT, REQUIRED), null, "an unfinished required field is never invented");
  assert.equal(repairTruncatedJson('{"isImportItem":true,"hsCode":"9999"', REQUIRED), null);
});
test("repair is used after a failed retry when the cut only hit an optional field", async () => {
  const cutLate = '{"isImportItem":true,"category":"Fragrance","hsCode":"3307.4100","cleanDescription":"Liquid incense","options":[{"hsCode":"3307.49","reas';
  const s = scripted([{ content: cutLate, finishReason: "length" }]);
  const r = await requestJsonObject<{ hsCode: string; options?: unknown }>(s.call, MSGS, { maxTokens: 900, retryMaxTokens: 1800, requiredKeys: REQUIRED });
  assert.equal(r.parsed.hsCode, "3307.4100");
  assert.equal(r.parsed.options, undefined);
});
test("the review text never shows raw JSON or an API body", () => {
  assert.equal(friendlyAiFailure(new AiReplyError("cut_off")), "The AI reply was cut off; try Ask AI again.");
  assert.equal(friendlyAiFailure(new Error(`Invalid JSON from reasoning AI: ${CUT}`)), "the AI reply could not be read");
  assert.equal(friendlyAiFailure(new Error('OpenRouter API error: 429 {"error":"rate"}')), "the AI service returned an error (429)");
  assert.equal(friendlyAiFailure(new Error("OPENROUTER_API_KEY is not set")), "the AI service is not set up");
});

void Promise.all(pending).then(() => {
  invalidateHsReferenceCache();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});