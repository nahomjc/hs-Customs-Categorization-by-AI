/**
 * Offline test for unclear product names: product context, reviewer note,
 * several web searches, ranked options + one question, and how the review
 * screen and the chat present them. All AI / search answers are mocked, and the
 * names are made-up generic ones. No database, no network.
 *
 *   npm run test:hs-ambiguous
 */
import assert from "node:assert/strict";
import { parseOptions, parseQuestion } from "../lib/hs-options";
import {
  buildWebSearchUserPrompt,
  getWebSearchConfig,
  runWebSearchClassification,
  type WebSearchConfig,
  type WebSearchInput,
  type WebSearchResult,
} from "../lib/hs-web-search";
import {
  invalidateHsReferenceCache,
  setHsReferenceCache,
  type HsReferenceCacheRow,
} from "../lib/hsReferenceCache";
import {
  applyWebSearchStep,
  buildSearchQueries,
  type FirstPass,
  type StepDeps,
} from "../lib/import-cases/hs-web-step";
import {
  CONTEXT_LIMITS,
  buildContextPromptBlock,
  buildProductContext,
  getReviewerNote,
  sanitizeNote,
  withReviewerNote,
} from "../lib/import-cases/product-context";
import { buildClassificationReviewView } from "../lib/import-cases/classification-review-view";
import { formatHsChatReply } from "../lib/ai/hs-chat-intent";

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

function row(hsCode: string, description: string): HsReferenceCacheRow {
  return {
    heading: hsCode.slice(0, 4),
    hsCode,
    normalizedHs: hsCode,
    tariffNo: hsCode,
    description,
    stdUnit: "kg",
    dutyRate: "20",
    chapter: hsCode.slice(0, 2),
  };
}

const BOOK: HsReferenceCacheRow[] = [
  row("9504.4000", "- Playing cards"),
  row("4911.9900", "- - Other printed matter, including printed pictures and photographs"),
  row("8523.5200", "- - Smart cards"),
  row("0305.4900", "- - Other smoked fish, including fillets"),
  row("1604.1900", "- - Other prepared or preserved fish"),
  row("2309.9000", "- Other preparations of a kind used in animal feeding"),
];

const CONFIG: WebSearchConfig = {
  enabled: true,
  mode: "fallback",
  model: "openai/gpt-4o-mini",
  engine: "exa",
  maxResults: 5,
  timeoutMs: 45_000,
  maxQueries: 3,
  budgetMs: 100_000,
};

function first(over: Partial<FirstPass> = {}): FirstPass {
  return {
    isImportItem: true,
    hsCode: "9999",
    category: "Other",
    cleanDescription: "Foo card",
    confidence: 0.2,
    source: "ai_suggestion",
    ...over,
  };
}

type Answer = {
  hsCode?: string | null;
  confidence?: number;
  options?: Array<{ hsCode: string; reason?: string }>;
  question?: string;
  cited?: boolean;
};
function answer(a: Answer = {}): WebSearchResult {
  const cited = a.cited !== false;
  return {
    ok: true,
    output: {
      isImportItem: true,
      hsCode: a.hsCode === undefined ? null : a.hsCode,
      confidence: a.confidence ?? 0.4,
      reasoning: "Mock reasoning.",
      sources: cited
        ? [{ url: "https://example.org/what-is-it", title: "What is it", fromSearch: true }]
        : [],
      alternatives: a.options ?? [],
      question: a.question,
      model: "mock",
    },
  };
}
function spy(results: WebSearchResult[]) {
  const calls: WebSearchInput[] = [];
  const search: StepDeps["search"] = async (input) => {
    calls.push(input);
    return results[Math.min(calls.length - 1, results.length - 1)];
  };
  return { calls, search };
}

async function main() {
  setHsReferenceCache(BOOK);

  console.log("ambiguous names -> ranked options and one question");
  const Q = "Is this a playing card or a gift card?";
  test("Foo card: web gives no single code -> ranked, validated options + question", async () => {
    const { search } = spy([
      answer({
        options: [
          { hsCode: "8523.52", reason: "if it is a smart / gift card" },
          { hsCode: "9504.40", reason: "if it is a playing card" },
          { hsCode: "1234.56", reason: "made up, not in the tariff book" },
        ],
        question: Q,
      }),
    ]);
    const r = await applyWebSearchStep(
      {
        description: "Foo card",
        first: first({ options: [{ hsCode: "4911.99", reason: "printed card" }], question: "x?" }),
      },
      { config: CONFIG, search },
    );
    assert.equal(r.hsCode, "9999");
    assert.equal(r.review.required, true);
    assert.equal(r.review.decisionRequired, true);
    assert.equal(r.review.question, Q);
    assert.deepEqual(
      r.review.alternatives.map((a) => a.hsCode),
      ["8523.5200", "9504.4000", "4911.9900"],
    );
    assert.ok(r.review.alternatives.every((a) => a.inTariffBook && a.officialDescription));
    assert.ok(!r.review.alternatives.some((a) => a.hsCode.startsWith("1234")));
    assert.match(r.review.reason ?? "", /^No clear tariff match/);
    assert.match(r.review.reason ?? "", /options below/);
    assert.match(r.review.confidenceNote, /3 options/);
  });
  test("Bar Little Bird: web turned off -> the AI's own options are still offered", async () => {
    const { calls, search } = spy([answer()]);
    const r = await applyWebSearchStep(
      {
        description: "Bar Little Bird",
        first: first({
          cleanDescription: "Bar Little Bird",
          options: [
            { hsCode: "0305.49", reason: "if it is a smoked fish snack" },
            { hsCode: "1604.19", reason: "if it is prepared fish" },
          ],
          question: "Is this a fish snack or a pet food?",
        }),
      },
      { config: { ...CONFIG, enabled: false }, search },
    );
    assert.equal(calls.length, 0);
    assert.equal(r.hsCode, "9999");
    assert.equal(r.review.decisionRequired, true);
    assert.equal(r.review.question, "Is this a fish snack or a pet food?");
    assert.deepEqual(r.review.alternatives.map((a) => a.hsCode), ["0305.4900", "1604.1900"]);
    assert.match(r.review.reason ?? "", /Pick one of the options/);
  });
  test("Baz Angel: web search fails -> fallback keeps the options and says so", async () => {
    const failing: StepDeps["search"] = async () => ({ ok: false, error: "timed out" });
    const r = await applyWebSearchStep(
      {
        description: "Baz Angel",
        first: first({
          cleanDescription: "Baz Angel",
          options: [{ hsCode: "2309.90", reason: "if it is animal feed" }, { hsCode: "0305.49" }],
        }),
      },
      { config: CONFIG, search: failing },
    );
    assert.equal(r.review.web.error, "timed out");
    assert.equal(r.review.web.attempted, true);
    assert.equal(r.review.decisionRequired, true);
    assert.equal(r.review.alternatives.length, 2);
    assert.equal(r.hsCode, "9999");
  });
  test("no options at all but a question -> still needs a decision, nothing invented", async () => {
    const r = await applyWebSearchStep(
      { description: "Qux", first: first({ question: "What is it made of?" }) },
      { config: { ...CONFIG, enabled: false } },
    );
    assert.equal(r.review.decisionRequired, true);
    assert.equal(r.review.alternatives.length, 0);
    assert.equal(r.review.question, "What is it made of?");
    const bare = await applyWebSearchStep(
      { description: "Qux", first: first() },
      { config: { ...CONFIG, enabled: false } },
    );
    assert.equal(bare.review.decisionRequired, false);
    assert.equal(bare.review.required, true);
  });
  test("a confident web answer keeps its options as alternatives, no decision needed", async () => {
    const { search } = spy([
      answer({
        hsCode: "9504.40",
        confidence: 0.85,
        options: [{ hsCode: "8523.52", reason: "if it is a smart card" }],
        question: Q,
      }),
    ]);
    const r = await applyWebSearchStep(
      { description: "Foo card", first: first() },
      { config: CONFIG, search },
    );
    assert.equal(r.hsCode, "9504.4000");
    assert.equal(r.review.required, false);
    assert.equal(r.review.decisionRequired, false);
    assert.equal(r.review.alternatives[0].hsCode, "8523.5200");
    assert.equal(r.review.question, undefined);
  });
  test("a low-confidence primary with options is a decision too", async () => {
    const { search } = spy([
      answer({ hsCode: "9504.40", confidence: 0.45, options: [{ hsCode: "8523.52" }], question: Q }),
    ]);
    const r = await applyWebSearchStep(
      { description: "Foo card", first: first() },
      { config: CONFIG, search },
    );
    assert.equal(r.hsCode, "9504.4000");
    assert.equal(r.review.decisionRequired, true);
    assert.equal(r.review.question, Q);
    assert.ok(r.review.alternatives.some((a) => a.hsCode === "8523.5200"));
  });
  test("with an empty tariff book options are flagged as unchecked", async () => {
    invalidateHsReferenceCache();
    const r = await applyWebSearchStep(
      {
        description: "Foo card",
        first: first({ options: [{ hsCode: "9504.40" }, { hsCode: "nonsense" }] }),
      },
      { config: { ...CONFIG, enabled: false } },
    );
    assert.deepEqual(r.review.alternatives.map((a) => [a.hsCode, a.inTariffBook]), [["9504.4000", false]]);
    setHsReferenceCache(BOOK);
  });
  test("parsing options and the question", () => {
    assert.deepEqual(
      parseOptions([{ hsCode: "9504.40", reason: "a" }, "9504.40", { hsCode: "12" }, { hsCode: "8523.52" }, 5, null], 3).map((o) => o.hsCode),
      ["9504.40", "8523.52"],
    );
    assert.equal(parseQuestion("  Is it   a card?  "), "Is it a card?");
    assert.equal(parseQuestion(""), undefined);
    assert.equal(parseQuestion(42), undefined);
  });

  console.log("several web searches for an unclear name");
  const hints = {
    brand: "Foo",
    cjkNames: ["\u5361\u7247"],
    pinyinNames: ["ka pian"],
    supplier: "Acme Trading Ltd",
    origin: "CN",
    productType: undefined,
  };
  test("queries: name + type, brand / Chinese / pinyin, supplier context", () => {
    const q = buildSearchQueries({ description: "Foo card", hints }, 3);
    assert.equal(q.length, 3);
    assert.match(q[0], /Foo card/);
    assert.match(q[1], /Foo/);
    assert.match(q[1], /\u5361\u7247/);
    assert.match(q[1], /ka pian/);
    assert.match(q[2], /Acme Trading Ltd/);
    assert.match(q[2], /from CN/);
    assert.equal(new Set(q.map((s) => s.toLowerCase())).size, 3);
    assert.equal(buildSearchQueries({ description: "Foo card", hints }, 1).length, 1);
    const plain = buildSearchQueries({ description: "Foo card" }, 4);
    assert.ok(plain.length >= 2 && plain.every((s) => /Foo card/.test(s)));
    const noted = buildSearchQueries({ description: "Foo card", userNote: "dried fish snack" }, 1);
    assert.match(noted[0], /dried fish snack/);
  });
  test("tries the next search until one answer is good, then stops", async () => {
    const { calls, search } = spy([
      answer({ options: [{ hsCode: "9504.40" }], question: Q }),
      answer({ hsCode: "9504.40", confidence: 0.8 }),
      answer({ hsCode: "8523.52", confidence: 0.9 }),
    ]);
    const r = await applyWebSearchStep(
      { description: "Foo card", first: first(), hints },
      { config: CONFIG, search },
    );
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((c) => c.searchQuery).length, 2);
    assert.notEqual(calls[0].searchQuery, calls[1].searchQuery);
    assert.equal(r.hsCode, "9504.4000");
    assert.equal(r.review.web.queries?.length, 2);
  });
  test("a good first answer needs only one search", async () => {
    const { calls, search } = spy([answer({ hsCode: "9504.40", confidence: 0.9 })]);
    await applyWebSearchStep({ description: "Foo card", first: first(), hints }, { config: CONFIG, search });
    assert.equal(calls.length, 1);
  });
  test("the query cap and the time budget are respected", async () => {
    const weak = answer({ options: [{ hsCode: "9504.40" }], question: Q });
    const capped = spy([weak]);
    await applyWebSearchStep(
      { description: "Foo card", first: first(), hints },
      { config: { ...CONFIG, maxQueries: 2 }, search: capped.search },
    );
    assert.equal(capped.calls.length, 2);

    let t = 0;
    const calls: number[] = [];
    const slow: StepDeps["search"] = async () => {
      calls.push(t);
      t += 60_000; // every call "takes" 60s
      return weak;
    };
    const r = await applyWebSearchStep(
      { description: "Foo card", first: first(), hints },
      { config: { ...CONFIG, maxQueries: 4, budgetMs: 100_000 }, search: slow, now: () => t },
    );
    assert.equal(calls.length, 2); // 3rd would start after the 100s budget
    assert.equal(r.review.web.queries?.length, 2);
  });
  test("options and sources of all tries are pooled", async () => {
    const a1 = answer({ options: [{ hsCode: "8523.52" }] });
    const a2 = answer({ options: [{ hsCode: "9504.40" }], question: Q });
    if (a1.ok) a1.output.sources = [{ url: "https://one.example/a", fromSearch: true }];
    if (a2.ok) a2.output.sources = [{ url: "https://two.example/b", fromSearch: true }];
    const { search } = spy([a1, a2, a2]);
    const r = await applyWebSearchStep(
      { description: "Foo card", first: first(), hints },
      { config: CONFIG, search },
    );
    assert.deepEqual(
      r.review.web.sources.map((s) => s.url).sort(),
      ["https://one.example/a", "https://two.example/b"],
    );
    assert.ok(r.review.alternatives.length >= 2);
    assert.equal(r.review.question, Q);
  });
  test("settings: query cap and budget come from the environment", () => {
    const d = getWebSearchConfig({});
    assert.deepEqual([d.maxQueries, d.budgetMs], [3, 100_000]);
    const c = getWebSearchConfig({ HS_WEB_SEARCH_MAX_QUERIES: "9", HS_WEB_SEARCH_BUDGET_MS: "1" });
    assert.deepEqual([c.maxQueries, c.budgetMs], [4, 10_000]);
  });

  console.log("reviewer note");
  const NOTE = "dried fish snack";
  test("the note is part of the web prompt and request, as top-priority context", async () => {
    const prompt = buildWebSearchUserPrompt({
      description: "Foo card",
      userNote: NOTE,
      contextText: "Product record:\n- Name: Foo card",
      searchQuery: "Foo card dried fish snack HS code",
    });
    assert.match(prompt, /^Search the web for: Foo card dried fish snack HS code/);
    assert.match(prompt, /HIGHEST PRIORITY/);
    assert.match(prompt, /dried fish snack/);
    assert.ok(prompt.indexOf("dried fish snack") < prompt.indexOf("Product record"));

    let sent = "";
    const ok = await runWebSearchClassification(
      { description: "Foo card", userNote: NOTE },
      {
        apiKey: "k",
        config: CONFIG,
        fetchImpl: async (_u, init) => {
          sent = String(init.body);
          return new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"isImportItem":true,"hsCode":"0305.49","confidence":0.7}' } }],
            }),
          );
        },
      },
    );
    assert.ok(ok.ok);
    assert.match(sent, /dried fish snack/);
    assert.match(sent, /HIGHEST PRIORITY/);
  });
  test("the note reaches every search of the step and the final review", async () => {
    const { calls, search } = spy([answer({ hsCode: "0305.49", confidence: 0.8 })]);
    const r = await applyWebSearchStep(
      { description: "Foo card", first: first(), userNote: NOTE, contextText: "ctx" },
      { config: CONFIG, search },
    );
    assert.ok(calls.every((c) => c.userNote === NOTE && c.contextText === "ctx"));
    assert.match(calls[0].searchQuery ?? "", /dried fish snack/);
    assert.equal(r.review.userNoteUsed, true);
    assert.equal(r.hsCode, "0305.4900");
  });
  test("the note block for the first AI pass: note first, product confirmed, context after", () => {
    const block = buildContextPromptBlock({
      userNote: NOTE,
      assumeImportItem: true,
      contextText: "Product record:\n- Name: Foo card",
    });
    assert.ok(block.indexOf("HIGHEST PRIORITY") < block.indexOf("confirmed this line is a real product"));
    assert.ok(block.indexOf("confirmed") < block.indexOf("Context from the shipment documents"));
    assert.match(block, /dried fish snack/);
    assert.equal(buildContextPromptBlock({}), "");
  });
  test("note persistence: saved in the specifications JSON, kept next to existing data, cleared when empty", () => {
    const specs = { colour: "red", size: 3 };
    const saved = withReviewerNote(specs, `  ${NOTE}  `, { byUserId: "u1", at: "2026-01-01T00:00:00.000Z" });
    assert.equal(saved.colour, "red");
    assert.equal(getReviewerNote(saved), NOTE);
    assert.deepEqual(saved.reviewerNote, { text: NOTE, byUserId: "u1", at: "2026-01-01T00:00:00.000Z" });
    assert.equal(specs.colour, "red");
    assert.ok(!("reviewerNote" in specs)); // input not mutated
    // survives the JSON column round trip and is used by a later re-classification
    const fromDb = JSON.parse(JSON.stringify(saved));
    const ctx = buildProductContext({
      product: { rawDescription: "Foo card", technicalSpecifications: fromDb },
    });
    assert.equal(ctx.userNote, NOTE);
    assert.ok(!/reviewerNote/.test(ctx.text));
    assert.match(ctx.text, /colour=red/);
    // replace and clear
    assert.equal(getReviewerNote(withReviewerNote(saved, "playing cards")), "playing cards");
    const cleared = withReviewerNote(saved, "   ");
    assert.equal(getReviewerNote(cleared), "");
    assert.equal(cleared.colour, "red");
    // odd stored values never lose data or throw
    assert.equal(getReviewerNote(null), "");
    assert.equal(getReviewerNote([1, 2]), "");
    assert.deepEqual(withReviewerNote([1, 2], "x").normalizedSpecifications, [1, 2]);
    assert.equal(getReviewerNote(withReviewerNote(null, "x")), "x");
  });
  test("notes are cleaned and capped", () => {
    assert.equal(sanitizeNote("a\u0000b\r\n\r\n\r\n\r\nc"), "ab\n\nc");
    assert.equal(sanitizeNote("x".repeat(900)).length, CONTEXT_LIMITS.noteChars);
    assert.equal(sanitizeNote(42), "");
  });

  console.log("product context");
  test("real data from the documents is included, empties left out", () => {
    const ctx = buildProductContext({
      product: {
        rawDescription: "FOO CARD  (blue)",
        normalizedDescription: "Foo card",
        productName: "Foo card",
        brand: "Foo",
        quantity: "120.0000",
        unitOfMeasure: "pcs",
        unitPrice: "0.5000",
        lineTotalAmount: "60.00",
        currencyCode: "USD",
        countryOfOriginCode: "CN",
        material: null,
      },
      invoiceLines: [
        {
          supplierDescription: "Foo card \u5361\u7247",
          supplierSku: "FC-1",
          quantity: "120",
          unitOfMeasure: "pcs",
          unitPrice: "0.5",
          currencyCode: "USD",
          extra: { "Pinyin name": "ka pian", Remark: "paper, 54 sheets" },
        },
      ],
      packingLines: [
        { supplierDescription: "Foo card", packageType: "carton", numberOfPackages: "3", piecesPerPackage: "40", grossWeightKg: "6.5", extra: { CBM: "0.02" } },
      ],
      caseInfo: { importerName: "Importer PLC", supplierName: "Acme Trading Ltd", supplierCountryCode: "CN", incoterm: "FOB", invoiceCurrencyCode: "USD" },
      otherProducts: ["Foo card", "Toy cars", "Board games"],
    });
    for (const needle of [
      "Foo card",
      "Original wording: FOO CARD (blue)",
      "Brand: Foo",
      "Quantity: 120 pcs",
      "Unit price: 0.5 USD",
      "Amount: 60 USD",
      "Importer PLC",
      "Acme Trading Ltd (CN)",
      "FOB",
      "FC-1",
      "Pinyin name=ka pian",
      "Remark=paper, 54 sheets",
      "pieces per package: 40",
      "CBM=0.02",
      "Toy cars",
      "Board games",
    ]) {
      assert.ok(ctx.text.includes(needle), `missing: ${needle}`);
    }
    assert.ok(!/Material:/.test(ctx.text));
    assert.ok(!/Other products[^]*- Foo card\n/.test(ctx.text.replace("Foo card\n- Toy", "")));
    assert.deepEqual(ctx.hints.cjkNames, ["\u5361\u7247"]);
    assert.deepEqual(ctx.hints.pinyinNames, ["ka pian"]);
    assert.equal(ctx.hints.brand, "Foo");
    assert.equal(ctx.hints.supplier, "Acme Trading Ltd");
    assert.equal(ctx.hints.origin, "CN");
  });
  test("the context stays bounded however much data there is", () => {
    const big = "x".repeat(2000);
    const extra = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`col${i}`, big]));
    const ctx = buildProductContext({
      product: { rawDescription: big, normalizedDescription: big, productName: big, technicalSpecifications: extra },
      invoiceLines: Array.from({ length: 40 }, () => ({ supplierDescription: big, extra })),
      packingLines: Array.from({ length: 40 }, () => ({ supplierDescription: big, extra })),
      caseInfo: { importerName: big, supplierName: big },
      otherProducts: Array.from({ length: 200 }, (_, i) => `${big} ${i}`),
    });
    assert.ok(ctx.text.length <= CONTEXT_LIMITS.totalChars, String(ctx.text.length));
    assert.ok(ctx.text.length > 500);
    assert.equal(buildProductContext({ product: { rawDescription: "" } }).text, "");
    const many = buildProductContext({
      product: { rawDescription: "A" },
      invoiceLines: Array.from({ length: 10 }, (_, i) => ({ supplierDescription: `line ${i}` })),
    });
    assert.equal((many.text.match(/wording: "line/g) ?? []).length, CONTEXT_LIMITS.lines);
  });

  console.log("review screen and chat");
  test("the review row gets the decision, the question and ranked options", async () => {
    const { search } = spy([answer({ options: [{ hsCode: "8523.52", reason: "smart card" }, { hsCode: "9504.40", reason: "playing card" }], question: Q })]);
    const step = await applyWebSearchStep(
      { description: "Foo card", first: first(), userNote: NOTE },
      { config: CONFIG, search },
    );
    const candidates = [
      { id: "c1", hsCode: step.hsCode, rank: 1, officialDescription: "Other", reasoning: "x", classificationEvidence: { review: step.review } },
      ...step.review.alternatives.map((a, i) => ({
        id: `a${i}`,
        hsCode: a.hsCode,
        rank: i + 2,
        officialDescription: a.officialDescription,
        reasoning: a.reason ?? "",
        classificationEvidence: { role: "alternative", scored: false },
      })),
    ];
    // the stored review goes through the JSON column
    candidates[0].classificationEvidence = JSON.parse(JSON.stringify(candidates[0].classificationEvidence));
    const view = buildClassificationReviewView(candidates, { hsCode: "9999", selectedCandidateId: "c1" });
    assert.equal(view.noCode, true);
    assert.equal(view.decisionRequired, true);
    assert.equal(view.question, Q);
    assert.equal(view.userNoteUsed, true);
    assert.deepEqual(view.alternatives.map((a) => a.hsCode), ["8523.5200", "9504.4000"]);
    assert.ok(view.searchQueries.length >= 1);
    const empty = buildClassificationReviewView([], null);
    assert.deepEqual([empty.decisionRequired, empty.question, empty.userNoteUsed], [false, null, false]);
  });
  test("the chat shows options and the question, never 'I don't know' or 9999", async () => {
    const step = await applyWebSearchStep(
      {
        description: "Foo card",
        first: first({ options: [{ hsCode: "9504.40", reason: "playing card" }, { hsCode: "8523.52", reason: "smart card" }], question: Q }),
      },
      { config: { ...CONFIG, enabled: false } },
    );
    const reply = formatHsChatReply("Foo card", {
      isImportItem: true,
      hsCode: step.hsCode,
      category: "Other",
      cleanDescription: "Foo card",
      confidence: step.confidence,
      source: "ai_suggestion",
      review: step.review,
    });
    assert.match(reply, /Most likely options/);
    assert.match(reply, /1\. 9504\.4000 - Playing cards \(playing card\)/);
    assert.match(reply, /2\. 8523\.5200/);
    assert.match(reply, /playing card or a gift card\?/);
    assert.match(reply, /Ask AI again/);
    assert.doesNotMatch(reply, /don't know|do not know|\*\*9999\*\*/i);
    assert.doesNotMatch(reply, /could not find a confident/);
  });

  await Promise.all(pending);
  invalidateHsReferenceCache();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();