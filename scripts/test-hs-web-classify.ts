/**
 * Offline test for web-search HS classification: catch-all detection,
 * validation against the tariff book, the fallback when search fails, the
 * "Electrolyte Water" case, the review view, the chat intent and the approval
 * guard. All AI / search answers are mocked. No database, no network.
 *
 *   npm run test:hs-web-classify
 */
import assert from "node:assert/strict";
import {
  approvalBlockReason,
  getReferenceMinScore,
  isBareOtherDescription,
  isCatchAllHsCode,
  isWeakReferenceMatch,
} from "../lib/hs-catch-all";
import { resolveAgainstReference } from "../lib/hs-reference-resolve";
import {
  getWebSearchConfig,
  parseWebSearchResponse,
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
  shouldUseWebSearch,
  type FirstPass,
  type StepDeps,
} from "../lib/import-cases/hs-web-step";
import { buildClassificationReviewView } from "../lib/import-cases/classification-review-view";
import {
  formatAskWhichProduct,
  formatHsChatReply,
  parseHsChatQuestion,
} from "../lib/ai/hs-chat-intent";

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
  // keep order: run sequentially
  pending.push(
    pending.length === 0 ? run() : pending[pending.length - 1].then(run),
  );
}

function row(
  hsCode: string,
  description: string,
  tariffNo = hsCode,
): HsReferenceCacheRow {
  return {
    heading: hsCode.slice(0, 4),
    hsCode,
    normalizedHs: hsCode,
    tariffNo,
    description,
    stdUnit: "kg",
    dutyRate: "20",
    chapter: hsCode.slice(0, 2),
  };
}

/** Tariff book where 2202.9900 exists (exact case). */
const BOOK_EXACT: HsReferenceCacheRow[] = [
  row("2202", "Other"), // bare heading "Other" row
  row("2202.1000", "- Waters, including mineral waters and aerated waters, containing added sugar or other sweetening matter or flavoured"),
  row("2202.9900", "- - Other"),
  row("0902.1000", "- - Green tea (not fermented) in immediate packings of a content not exceeding 3 kg"),
  row("9405.1000", "- Chandeliers and other electric ceiling or wall lighting fittings"),
];

/** Tariff book where only national 8-digit codes exist under 2202.99 (mapped case). */
const BOOK_MAPPED: HsReferenceCacheRow[] = [
  row("2202.1000", "- Waters, including mineral waters and aerated waters, containing added sugar or other sweetening matter or flavoured"),
  row("2202.9910", "- - - Sports and energy drinks containing electrolytes"),
  row("2202.9990", "- - - Other"),
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

function firstPass(over: Partial<FirstPass> = {}): FirstPass {
  return {
    isImportItem: true,
    hsCode: "9999",
    category: "Other",
    cleanDescription: "Electrolyte Water",
    confidence: 0.5,
    source: "ai_suggestion",
    ...over,
  };
}

function okSearch(
  over: Partial<{
    hsCode: string | null;
    confidence: number;
    sources: Array<{ url: string; title?: string; fromSearch: boolean }>;
    alternatives: Array<{ hsCode: string; reason?: string }>;
    isImportItem: boolean;
  }> = {},
): WebSearchResult {
  return {
    ok: true,
    output: {
      isImportItem: over.isImportItem ?? true,
      hsCode: over.hsCode === undefined ? "2202.99" : over.hsCode,
      confidence: over.confidence ?? 0.82,
      reasoning:
        "Flavoured electrolyte drinking water without added sugar is a non-alcoholic beverage of heading 2202.",
      sources: over.sources ?? [
        {
          url: "https://hts.usitc.gov/search?query=2202.99",
          title: "HTS 2202.99",
          fromSearch: true,
        },
        {
          url: "https://www.trade.gov/hs-2202",
          title: "Trade.gov HS 2202",
          fromSearch: true,
        },
      ],
      alternatives: over.alternatives ?? [
        { hsCode: "2202.10", reason: "if sweetened or flavoured" },
      ],
      model: "openai/gpt-4o-mini",
    },
  };
}

function spySearch(result: WebSearchResult) {
  const calls: WebSearchInput[] = [];
  const search: StepDeps["search"] = async (input) => {
    calls.push(input);
    return result;
  };
  return { calls, search };
}

async function main() {
  console.log("catch-all detection");
  test("placeholders are catch-alls", () => {
    for (const code of ["9999", "9999.00", "9999.99", "0000.00", "EXCLUDE", "NEED_INFO", "", null, "9901.00", "98"]) {
      assert.equal(isCatchAllHsCode(code), true, String(code));
    }
  });
  test("real codes are not catch-alls", () => {
    for (const code of ["2202.99", "2202.9900", "0902.10", "9405.10", "2202"]) {
      assert.equal(isCatchAllHsCode(code), false, code);
    }
  });
  test("subheading 'Other' with a real code stays legitimate", () => {
    assert.equal(isCatchAllHsCode("2202.99", { description: "- - Other" }), false);
    assert.equal(isCatchAllHsCode("2202.9900", { description: "Other" }), false);
  });
  test("heading-level 'Other' row is a catch-all, a described heading is not", () => {
    assert.equal(isCatchAllHsCode("2202", { description: "Other" }), true);
    assert.equal(isCatchAllHsCode("2202", { description: "Waters and beverages" }), false);
  });
  test("bare 'Other' descriptions", () => {
    for (const d of ["Other", "- - Other", "Others", "n.e.s.", "nes", "  - - - Other. "]) {
      assert.equal(isBareOtherDescription(d), true, d);
    }
    assert.equal(isBareOtherDescription("Other beverages"), false);
    assert.equal(isBareOtherDescription(""), false);
  });
  test("weak reference matches go to the AI step", () => {
    assert.equal(getReferenceMinScore({}), 3);
    assert.equal(isWeakReferenceMatch({ score: 2, description: "Green tea" }, 3), true);
    assert.equal(isWeakReferenceMatch({ score: 5, description: "- - Other" }, 3), true);
    assert.equal(isWeakReferenceMatch({ score: 5, description: "Green tea" }, 3), false);
    assert.equal(getReferenceMinScore({ HS_REFERENCE_MIN_SCORE: "5" }), 5);
    assert.equal(getReferenceMinScore({ HS_REFERENCE_MIN_SCORE: "abc" }), 3);
  });
  test("approval guard blocks placeholders and heading catch-alls only", () => {
    assert.ok(approvalBlockReason("9999", { manual: false }));
    assert.ok(approvalBlockReason("9999", { manual: true }));
    assert.ok(approvalBlockReason("", { manual: true }));
    assert.ok(approvalBlockReason("2202", { manual: false, referenceRow: { description: "Other" } }));
    assert.equal(approvalBlockReason("2202", { manual: true, referenceRow: { description: "Other" } }), null);
    assert.equal(approvalBlockReason("2202.99", { manual: false, referenceRow: { description: "- - Other" } }), null);
    assert.equal(approvalBlockReason("2202.9900", { manual: true }), null);
  });

  console.log("web search config and response parsing");
  test("config defaults, switches and limits", () => {
    const d = getWebSearchConfig({});
    assert.deepEqual(
      [d.enabled, d.mode, d.model, d.engine, d.maxResults, d.timeoutMs],
      [true, "fallback", "openai/gpt-4o-mini", "exa", 5, 45_000],
    );
    for (const v of ["off", "0", "false", "OFF"]) {
      assert.equal(getWebSearchConfig({ HS_WEB_SEARCH: v }).enabled, false, v);
    }
    const c = getWebSearchConfig({
      HS_WEB_SEARCH_MODE: "always",
      HS_WEB_SEARCH_MODEL: "perplexity/sonar",
      HS_WEB_SEARCH_ENGINE: "native",
      HS_WEB_SEARCH_MAX_RESULTS: "99",
      HS_WEB_SEARCH_TIMEOUT_MS: "1",
    });
    assert.deepEqual(
      [c.mode, c.model, c.engine, c.maxResults, c.timeoutMs],
      ["always", "perplexity/sonar", "native", 10, 45_000],
    );
  });

  const goodPayload = {
    choices: [
      {
        message: {
          content:
            'Here you go:\n```json\n{"isImportItem":true,"hsCode":"2202.99","confidence":0.9,"reasoning":"Non-alcoholic beverage.","sources":[{"url":"https://example.org/a","title":"A"},{"url":"javascript:alert(1)","title":"bad"},{"url":"https://hts.usitc.gov/x","title":"HTS"}],"alternatives":[{"hsCode":"2202.10","reason":"sweetened"}]}\n```',
          annotations: [
            {
              type: "url_citation",
              url_citation: { url: "https://hts.usitc.gov/x", title: "HTS 2202.99" },
            },
          ],
        },
      },
    ],
  };
  test("citations are merged, unsafe URLs dropped, model-only sources flagged", () => {
    const r = parseWebSearchResponse(goodPayload, "m");
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.output.hsCode, "2202.99");
    assert.equal(r.output.confidence, 0.9);
    const urls = r.output.sources.map((s) => s.url);
    assert.deepEqual(urls.sort(), ["https://example.org/a", "https://hts.usitc.gov/x"]);
    assert.equal(r.output.sources.find((s) => s.url.includes("usitc"))?.fromSearch, true);
    assert.equal(r.output.sources.find((s) => s.url.includes("example.org"))?.fromSearch, false);
    assert.equal(r.output.alternatives[0].hsCode, "2202.10");
  });
  test("no search citation caps the confidence", () => {
    const payload = JSON.parse(JSON.stringify(goodPayload));
    payload.choices[0].message.annotations = [];
    const r = parseWebSearchResponse(payload, "m");
    assert.ok(r.ok && r.output.confidence <= 0.55);
  });
  test("bad replies become errors, null code is kept as null", () => {
    assert.equal(parseWebSearchResponse({ choices: [] }, "m").ok, false);
    assert.equal(parseWebSearchResponse({ choices: [{ message: { content: "no json" } }] }, "m").ok, false);
    const r = parseWebSearchResponse(
      { choices: [{ message: { content: '{"isImportItem":true,"hsCode":null,"confidence":0.4}' } }] },
      "m",
    );
    assert.ok(r.ok && r.output.hsCode === null);
  });
  test("request uses the OpenRouter web plugin and never throws", async () => {
    let body: Record<string, unknown> = {};
    let auth = "";
    const input: WebSearchInput = { description: "Electrolyte Water" };
    const ok = await runWebSearchClassification(input, {
      apiKey: "test-key",
      config: CONFIG,
      fetchImpl: async (_url, init) => {
        body = JSON.parse(String(init.body));
        auth = String((init.headers as Record<string, string>).Authorization);
        return new Response(JSON.stringify(goodPayload), { status: 200 });
      },
    });
    assert.ok(ok.ok);
    assert.deepEqual(body.plugins, [{ id: "web", max_results: 5, engine: "exa" }]);
    assert.equal(body.model, "openai/gpt-4o-mini");
    assert.equal(auth, "Bearer test-key");
    assert.match(JSON.stringify(body.messages), /Electrolyte Water/);

    const http = await runWebSearchClassification(input, {
      apiKey: "k",
      config: CONFIG,
      fetchImpl: async () => new Response("boom", { status: 500 }),
    });
    assert.ok(!http.ok && /500/.test(http.error));
    const thrown = await runWebSearchClassification(input, {
      apiKey: "k",
      config: CONFIG,
      fetchImpl: async () => {
        throw new Error("network down");
      },
    });
    assert.ok(!thrown.ok && /network down/.test(thrown.error));
    const noKey = await runWebSearchClassification(input, {
      apiKey: "",
      config: CONFIG,
      fetchImpl: async () => new Response("{}"),
    });
    assert.ok(!noKey.ok);
  });

  console.log("validation against the tariff book");
  test("exact code is accepted as is", () => {
    setHsReferenceCache(BOOK_EXACT);
    const r = resolveAgainstReference("2202.99", "Electrolyte Water");
    assert.equal(r.status, "exact");
    assert.equal(r.status === "exact" && r.hsCode, "2202.9900");
  });
  test("a missing national code is mapped to a real code under the same subheading", () => {
    setHsReferenceCache(BOOK_MAPPED);
    const r = resolveAgainstReference("2202.99", "Electrolyte Water sports drink electrolytes");
    assert.equal(r.status, "mapped");
    if (r.status !== "mapped") return;
    assert.equal(r.hsCode, "2202.9910");
    assert.equal(r.ambiguous, false);
    assert.deepEqual(r.siblings.map((s) => s.hsCode), ["2202.9990"]);
  });
  test("equally plausible rows are flagged ambiguous", () => {
    setHsReferenceCache(BOOK_MAPPED);
    const r = resolveAgainstReference("2202.99", "water");
    assert.equal(r.status === "mapped" && r.ambiguous, true);
  });
  test("codes that are not in the book are never invented", () => {
    setHsReferenceCache(BOOK_EXACT);
    const missing = resolveAgainstReference("2202.55", "x");
    assert.deepEqual(
      [missing.status, missing.status === "unresolved" && missing.reason],
      ["unresolved", "not_in_tariff_book"],
    );
    const placeholder = resolveAgainstReference("9999", "x");
    assert.equal(placeholder.status === "unresolved" && placeholder.reason, "placeholder");
    const bad = resolveAgainstReference("abc", "x");
    assert.equal(bad.status === "unresolved" && bad.reason, "bad_format");
  });
  test("an empty tariff book leaves a format-valid code unverified", () => {
    invalidateHsReferenceCache();
    const r = resolveAgainstReference("2202.99", "x");
    assert.equal(r.status, "unverified");
    assert.equal(r.status === "unverified" && r.hsCode, "2202.9900");
    setHsReferenceCache(BOOK_EXACT);
  });

  console.log("web-search step");
  test("web search is used only when there is no confident match", () => {
    setHsReferenceCache(BOOK_EXACT);
    assert.equal(shouldUseWebSearch(firstPass(), { config: CONFIG }).use, true);
    const confident = firstPass({ hsCode: "2202.1000", confidence: 0.9 });
    assert.equal(shouldUseWebSearch(confident, { config: CONFIG }).use, false);
    assert.equal(shouldUseWebSearch(confident, { config: CONFIG, forceAi: true }).use, true);
    assert.equal(shouldUseWebSearch(confident, { config: { ...CONFIG, mode: "always" } }).use, true);
    assert.equal(shouldUseWebSearch(firstPass({ confidence: 0.5, hsCode: "2202.1000" }), { config: CONFIG }).use, true);
    assert.equal(shouldUseWebSearch(firstPass({ hsCode: "2202.55", confidence: 0.9 }), { config: CONFIG }).use, true);
    assert.equal(shouldUseWebSearch(firstPass({ isImportItem: false, hsCode: "EXCLUDE" }), { config: CONFIG }).use, false);
    assert.equal(shouldUseWebSearch(firstPass(), { config: { ...CONFIG, enabled: false } }).use, false);
  });

  test("Electrolyte Water: 9999 + web search resolves to a 2202.xx code", async () => {
    setHsReferenceCache(BOOK_EXACT);
    const { calls, search } = spySearch(okSearch());
    const r = await applyWebSearchStep(
      { description: "Electrolyte Water", first: firstPass() },
      {
        config: CONFIG,
        search,
        getCandidates: async () => ["2202.1000 (2202.1000): Waters, including mineral waters"],
        getNotes: async () => ({ text: "Chapter 22 note 1", chapters: ["22"] }),
      },
    );
    assert.equal(calls.length, 1);
    assert.match(calls[0].referenceCandidates?.[0] ?? "", /2202/);
    assert.match(calls[0].notesText ?? "", /Chapter 22/);
    assert.equal(r.hsCode, "2202.9900");
    assert.ok(r.hsCode.startsWith("2202"));
    assert.equal(r.review.web.used, true);
    assert.equal(r.review.web.sources.length, 2);
    assert.equal(r.review.required, false);
    assert.match(r.review.confidenceNote, /High|Medium/);
    assert.equal(r.review.alternatives[0].hsCode, "2202.1000");
    assert.ok(r.confidence > 0.6);
  });
  test("Electrolyte Water: nearest real code when the national code is missing", async () => {
    setHsReferenceCache(BOOK_MAPPED);
    const { search } = spySearch(okSearch());
    const r = await applyWebSearchStep(
      { description: "Electrolyte Water", first: firstPass() },
      { config: CONFIG, search },
    );
    assert.equal(r.hsCode, "2202.9910");
    assert.equal(r.review.required, true);
    assert.match(r.review.reason ?? "", /closest code in the tariff book/);
    assert.equal(r.review.proposedCode?.hsCode, "2202.99");
    assert.ok(r.review.alternatives.some((a) => a.hsCode === "2202.9990"));
    assert.ok(r.confidence <= 0.7);
  });
  test("a code that is not in the tariff book is never used", async () => {
    setHsReferenceCache(BOOK_EXACT);
    const { search } = spySearch(okSearch({ hsCode: "2202.55" }));
    const r = await applyWebSearchStep(
      { description: "Electrolyte Water", first: firstPass() },
      { config: CONFIG, search },
    );
    assert.equal(r.hsCode, "9999");
    assert.equal(r.review.required, true);
    assert.match(r.review.reason ?? "", /^No clear tariff match/);
    assert.equal(r.review.proposedCode?.hsCode, "2202.55");
    assert.equal(r.review.proposedCode?.validation, "unresolved");
  });
  test("search failure falls back to the plain AI result and says so", async () => {
    setHsReferenceCache(BOOK_EXACT);
    const failing: StepDeps["search"] = async () => ({ ok: false, error: "timed out" });
    const r = await applyWebSearchStep(
      { description: "Electrolyte Water", first: firstPass() },
      { config: CONFIG, search: failing },
    );
    assert.equal(r.hsCode, "9999");
    assert.equal(r.review.required, true);
    assert.match(r.review.reason ?? "", /^No clear tariff match/);
    assert.equal(r.review.web.attempted, true);
    assert.equal(r.review.web.used, false);
    assert.equal(r.review.web.error, "timed out");
    // a valid earlier answer is kept untouched when web search fails
    const kept = await applyWebSearchStep(
      {
        description: "Mineral water",
        first: firstPass({ hsCode: "2202.1000", confidence: 0.9 }),
        forceAi: true,
      },
      { config: CONFIG, search: failing },
    );
    assert.equal(kept.hsCode, "2202.1000");
    assert.equal(kept.review.required, false);
    assert.equal(kept.review.web.error, "timed out");
  });
  test("a search that throws inside deps cannot break the step", async () => {
    setHsReferenceCache(BOOK_EXACT);
    const r = await applyWebSearchStep(
      { description: "Electrolyte Water", first: firstPass() },
      {
        config: CONFIG,
        search: async () => ({ ok: false, error: "x" }),
        getCandidates: async () => {
          throw new Error("db down");
        },
        getNotes: async () => {
          throw new Error("db down");
        },
      },
    );
    assert.equal(r.hsCode, "9999");
  });
  test("web search turned off: no call, catch-all still sent to review", async () => {
    setHsReferenceCache(BOOK_EXACT);
    const { calls, search } = spySearch(okSearch());
    const r = await applyWebSearchStep(
      { description: "Electrolyte Water", first: firstPass() },
      { config: { ...CONFIG, enabled: false }, search },
    );
    assert.equal(calls.length, 0);
    assert.equal(r.hsCode, "9999");
    assert.equal(r.review.required, true);
    assert.match(r.review.reason ?? "", /No clear tariff match/);
    assert.match(r.review.confidenceNote, /No code suggested/);
  });
  test("a confident answer does not trigger a search", async () => {
    setHsReferenceCache(BOOK_EXACT);
    const { calls, search } = spySearch(okSearch());
    const r = await applyWebSearchStep(
      {
        description: "Green tea",
        first: firstPass({ hsCode: "0902.1000", confidence: 0.9, category: "Tea" }),
      },
      { config: CONFIG, search },
    );
    assert.equal(calls.length, 0);
    assert.equal(r.hsCode, "0902.1000");
    assert.equal(r.review.required, false);
  });
  test("a changed answer keeps the previous suggestion for the reviewer", async () => {
    setHsReferenceCache(BOOK_EXACT);
    const { search } = spySearch(okSearch({ hsCode: "2202.99", alternatives: [] }));
    const r = await applyWebSearchStep(
      {
        description: "Electrolyte Water",
        first: firstPass({ hsCode: "2202.1000", confidence: 0.55 }),
      },
      { config: CONFIG, search },
    );
    assert.equal(r.hsCode, "2202.9900");
    assert.equal(r.review.previous?.hsCode, "2202.1000");
    assert.ok(r.review.alternatives.some((a) => a.hsCode === "2202.1000"));
  });
  test("a non-item stays EXCLUDE and is never searched", async () => {
    const { calls, search } = spySearch(okSearch());
    const r = await applyWebSearchStep(
      {
        description: "Packing List",
        first: firstPass({ isImportItem: false, hsCode: "EXCLUDE" }),
      },
      { config: CONFIG, search },
    );
    assert.equal(calls.length, 0);
    assert.equal(r.hsCode, "EXCLUDE");
    assert.equal(r.review.required, false);
  });
  test("no search citation means review is required", async () => {
    setHsReferenceCache(BOOK_EXACT);
    const { search } = spySearch(
      okSearch({ confidence: 0.5, sources: [{ url: "https://example.org", fromSearch: false }] }),
    );
    const r = await applyWebSearchStep(
      { description: "Electrolyte Water", first: firstPass() },
      { config: CONFIG, search },
    );
    assert.equal(r.hsCode, "2202.9900");
    assert.equal(r.review.required, true);
    assert.match(r.review.reason ?? "", /No web source confirmed/);
  });
  test("chapter notes of the chosen chapter are applied with one re-check", async () => {
    setHsReferenceCache(BOOK_EXACT);
    const { calls, search } = spySearch(okSearch());
    let noteCalls = 0;
    const r = await applyWebSearchStep(
      { description: "Electrolyte Water", first: firstPass() },
      {
        config: CONFIG,
        search,
        getNotes: async (hints) => {
          noteCalls++;
          return hints.includes("2202.99")
            ? { text: "Chapter 22 Note 1", chapters: ["22"] }
            : { text: "Chapter 04 Note 1", chapters: ["04"] };
        },
      },
    );
    assert.equal(calls.length, 2);
    assert.equal(noteCalls, 2);
    assert.match(calls[1].notesText ?? "", /Chapter 22/);
    assert.equal(r.hsCode, "2202.9900");
  });

  console.log("review screen data");
  test("stored evidence becomes sources, alternatives and a reason", async () => {
    setHsReferenceCache(BOOK_MAPPED);
    const { search } = spySearch(okSearch());
    const r = await applyWebSearchStep(
      { description: "Electrolyte Water", first: firstPass() },
      { config: CONFIG, search },
    );
    const candidates = [
      {
        id: "c1",
        hsCode: r.hsCode,
        rank: 1,
        officialDescription: "Sports drinks",
        reasoning: "x",
        classificationEvidence: {
          review: {
            ...r.review,
            web: {
              ...r.review.web,
              sources: [
                ...r.review.web.sources,
                { url: "javascript:alert(1)", fromSearch: true },
              ],
            },
          },
        },
      },
      {
        id: "c2",
        hsCode: "2202.9990",
        rank: 2,
        officialDescription: "Other",
        reasoning: "Same subheading in the tariff book",
        classificationEvidence: { role: "alternative", scored: false },
      },
    ];
    const view = buildClassificationReviewView(candidates, {
      hsCode: r.hsCode,
      selectedCandidateId: "c1",
    });
    assert.equal(view.noCode, false);
    assert.equal(view.webUsed, true);
    assert.deepEqual(view.sources.map((s) => s.host), ["hts.usitc.gov", "trade.gov"]);
    assert.equal(view.alternatives[0].candidateId, "c2");
    assert.match(view.reason ?? "", /closest code/);
    assert.equal(view.proposedHsCode, "2202.99");
  });
  test("a catch-all is shown as 'no code', empty data shows nothing made up", () => {
    const view = buildClassificationReviewView(
      [
        {
          id: "c1",
          hsCode: "9999",
          rank: 1,
          officialDescription: "Other",
          reasoning: "x",
          classificationEvidence: null,
        },
      ],
      { hsCode: "9999", selectedCandidateId: "c1" },
    );
    assert.equal(view.noCode, true);
    assert.deepEqual(
      [view.reason, view.confidenceNote, view.sources.length, view.alternatives.length],
      [null, null, 0, 0],
    );
    const none = buildClassificationReviewView([], null);
    assert.equal(none.noCode, false);
  });

  console.log("dashboard chat");
  const q = (t: string, known: string[] = []) => parseHsChatQuestion(t, known);
  test("finds the product in common phrasings", () => {
    assert.equal(q("What is the HS code for Electrolyte Water?").product, "Electrolyte Water");
    assert.equal(q("hs code of palm olein oil").product, "palm olein oil");
    assert.equal(q("Please classify green tea 3kg").product, "green tea 3kg");
    assert.equal(q('what code for "Soy sauce 500ml" please').product, "Soy sauce 500ml");
    assert.equal(q("Electrolyte Water hs code?").product, "Electrolyte Water");
    assert.equal(q("what's the tariff code for kid's toy cars").product, "kid's toy cars");
  });
  test("matches products of the open case", () => {
    const known = ["Electrolyte Water 500ml x 24 bottles", "Green tea 3kg"];
    const a = q("what is the hs code for electrolyte water", known);
    assert.equal(a.product, "Electrolyte Water 500ml x 24 bottles");
    assert.equal(a.fromCase, true);
    assert.equal(q("hs code for Green tea 3kg", known).product, "Green tea 3kg");
  });
  test("asks which product when none is named, ignores other questions", () => {
    const a = q("what is the hs code?");
    assert.deepEqual([a.intent, a.product], [true, null]);
    assert.equal(q("what is the hs code for this product?").product, null);
    assert.equal(q("How does classification work?").intent, false);
    assert.equal(q("hello there").intent, false);
    assert.match(formatAskWhichProduct(["Green tea"]), /Which product/);
    assert.match(formatAskWhichProduct(["Green tea"]), /Green tea/);
  });
  test("reply shows the code, reasoning, sources and the approval note", async () => {
    setHsReferenceCache(BOOK_EXACT);
    const { search } = spySearch(okSearch());
    const step = await applyWebSearchStep(
      { description: "Electrolyte Water", first: firstPass() },
      { config: CONFIG, search },
    );
    const reply = formatHsChatReply("Electrolyte Water", {
      isImportItem: true,
      hsCode: step.hsCode,
      category: "Beverages",
      cleanDescription: "Electrolyte Water",
      confidence: step.confidence,
      source: "ai_suggestion",
      review: step.review,
    });
    assert.match(reply, /\*\*2202\.9900\*\*/);
    assert.match(reply, /https:\/\/hts\.usitc\.gov/);
    assert.match(reply, /AI with web search/);
    assert.match(reply, /Why:/);
    assert.match(reply, /must approve/);
    assert.doesNotMatch(reply, /Ask AI/);
  });
  test("reply for a catch-all says why instead of showing 9999", async () => {
    setHsReferenceCache(BOOK_EXACT);
    const step = await applyWebSearchStep(
      { description: "Electrolyte Water", first: firstPass() },
      { config: { ...CONFIG, enabled: false } },
    );
    const reply = formatHsChatReply("Electrolyte Water", {
      isImportItem: true,
      hsCode: step.hsCode,
      category: "Other",
      cleanDescription: "Electrolyte Water",
      confidence: step.confidence,
      source: "ai_suggestion",
      review: step.review,
    });
    assert.match(reply, /could not find a confident HS code/);
    assert.match(reply, /No clear tariff match/);
    assert.doesNotMatch(reply, /\*\*9999\*\*/);
  });

  await Promise.all(pending);
  invalidateHsReferenceCache();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();