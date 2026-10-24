/**
 * Offline test for the harmonization batching/progress logic and the
 * pagination helpers, plus a static-HTML smoke render of the new UI.
 * No database, no AI, no browser.
 *
 *   npm run test:progress-pagination
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Pagination } from "../components/dashboard/Pagination";
import {
  HarmonizeProgressBanner,
  HarmonizeProgressContent,
} from "../components/dashboard/import-case/HarmonizeProgressDialog";
import {
  GroupingProgressBanner,
  GroupingProgressContent,
} from "../components/dashboard/import-case/GroupingProgressDialog";
import {
  ClassifyProgressBanner,
  ClassifyProgressContent,
} from "../components/dashboard/import-case/ClassifyProgressDialog";
import {
  ClassifyJob,
  type ClassifyApi,
  type ClassifyBatchResult,
  type ClassifySnapshot,
  type ClassifySummary,
} from "../lib/import-cases/classify-progress";
import {
  GroupingJob,
  type GroupingApi,
  type GroupingBatchResult,
  type GroupingSnapshot,
} from "../lib/import-cases/grouping-progress";
import {
  buildGroupingPlan,
  buildTaxProfileHash,
  groupCodeFor,
  type GroupingInput,
} from "../lib/import-cases/grouping-plan";
import { BatchJobBase } from "../lib/import-cases/job-progress";
import {
  buildHarmonizePlan,
  chunk,
  mapWithConcurrency,
  sequenceRange,
} from "../lib/import-cases/harmonize-plan";
import {
  HarmonizeApiError,
  HarmonizeJob,
  elapsedMs,
  etaMs,
  formatDuration,
  percentOf,
  type HarmonizeApi,
  type HarmonizeSummary,
  type JobSnapshot,
  type ProductBatchResult,
  type VddBatchResult,
} from "../lib/import-cases/harmonize-progress";
import {
  clampPage,
  formatShowing,
  getPageBounds,
  getPageCount,
  getPageRange,
  paginate,
} from "../lib/import-cases/pagination";

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}\n  ${error instanceof Error ? error.stack : error}`);
  }
}

async function main() {
/* ------------------------------- pagination ------------------------------- */

await test("0 items: one empty page, nothing shown", () => {
  const b = getPageBounds(0, 1, 25);
  assert.deepEqual(
    [b.page, b.pageCount, b.start, b.end, b.from, b.to],
    [1, 1, 0, 0, 0, 0],
  );
  assert.equal(formatShowing(b), "Showing 0 of 0 lines");
  assert.deepEqual(getPageRange(1, getPageCount(0, 25)), [1]);
  assert.deepEqual(paginate([], 3, 10).items, []);
});

await test("1 page: everything on page 1", () => {
  const b = getPageBounds(7, 1, 25);
  assert.deepEqual([b.pageCount, b.from, b.to], [1, 1, 7]);
  assert.deepEqual(getPageRange(1, 1), [1]);
  assert.equal(formatShowing(b, "invoice lines"), "Showing 1\u20137 of 7 invoice lines");
});

await test("112 items: page math for every size", () => {
  const items = Array.from({ length: 112 }, (_, i) => i + 1);
  for (const [size, pages] of [[10, 12], [25, 5], [50, 3], [100, 2]] as const) {
    assert.equal(getPageCount(112, size), pages);
    const seen: number[] = [];
    for (let p = 1; p <= pages; p++) seen.push(...paginate(items, p, size).items);
    assert.deepEqual(seen, items, `size ${size} covers all rows exactly once`);
  }
  const last = getPageBounds(112, 5, 25);
  assert.deepEqual([last.from, last.to], [101, 112]);
  assert.equal(formatShowing(last), "Showing 101\u2013112 of 112 lines");
});

await test("page is clamped (list shrinks, bad input)", () => {
  assert.equal(getPageBounds(112, 99, 25).page, 5);
  assert.equal(getPageBounds(10, 5, 25).page, 1);
  assert.equal(clampPage(0, 5), 1);
  assert.equal(clampPage(Number.NaN, 5), 1);
  assert.equal(clampPage(-3, 5), 1);
  assert.equal(getPageBounds(Number.NaN, 1, 25).total, 0);
  assert.equal(getPageBounds(50, 1, 0).pageSize, 25);
});

await test("page range with ellipsis", () => {
  assert.deepEqual(getPageRange(1, 20), [1, 2, 3, 4, 5, "ellipsis-end", 20]);
  assert.deepEqual(getPageRange(3, 20), [1, 2, 3, 4, 5, "ellipsis-end", 20]);
  assert.deepEqual(getPageRange(4, 20), [1, 2, 3, 4, 5, "ellipsis-end", 20]);
  assert.deepEqual(getPageRange(5, 20), [1, "ellipsis-start", 4, 5, 6, "ellipsis-end", 20]);
  assert.deepEqual(getPageRange(10, 20), [1, "ellipsis-start", 9, 10, 11, "ellipsis-end", 20]);
  assert.deepEqual(getPageRange(20, 20), [1, "ellipsis-start", 16, 17, 18, 19, 20]);
  assert.deepEqual(getPageRange(18, 20), [1, "ellipsis-start", 16, 17, 18, 19, 20]);
  assert.deepEqual(getPageRange(1, 7), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(getPageRange(4, 8), [1, 2, 3, 4, 5, "ellipsis-end", 8]);
  assert.deepEqual(getPageRange(5, 8), [1, "ellipsis-start", 4, 5, 6, 7, 8]);
});

await test("page range invariants for every page of many page counts", () => {
  for (const pageCount of [1, 2, 5, 7, 8, 9, 12, 40, 100]) {
    for (let page = 1; page <= pageCount; page++) {
      const range = getPageRange(page, pageCount);
      const numbers = range.filter((x): x is number => typeof x === "number");
      assert.ok(numbers.includes(page), `current page ${page}/${pageCount} present`);
      assert.ok(numbers.includes(1) && numbers.includes(pageCount));
      assert.deepEqual([...numbers].sort((a, b) => a - b), numbers, "ascending");
      assert.equal(new Set(numbers).size, numbers.length, "unique");
      if (pageCount > 7) assert.equal(range.length, 7, "constant width");
      assert.ok(range.every((x) => x !== undefined && x !== null));
    }
  }
});

/* ------------------------------ harmonize plan ------------------------------ */

type Inv = Parameters<typeof buildHarmonizePlan>[0][number];
type Pack = Parameters<typeof buildHarmonizePlan>[1][number];
const inv = (id: string, n: number, d: string, sku: string | null, q = "5"): Inv => ({
  id, lineNumber: n, supplierDescription: d, supplierSku: sku, brand: null, modelNumber: null, quantity: q, unitOfMeasure: "pcs",
});
const pack = (id: string, n: number, d: string, sku: string | null, q = "5"): Pack => ({
  id, lineNumber: n, supplierDescription: d, supplierSku: sku, brand: null, modelNumber: null, quantity: q, unitOfMeasure: "pcs",
});

await test("plan: slots are contiguous, deterministic and typed like before", () => {
  const invs = [
    inv("i1", 1, "Steel bolt", "SKU1"),
    inv("i2", 2, "Copper wire roll", null, "9"),
    inv("i3", 3, "Unrelated thing", null),
  ];
  const packs = [
    pack("p1", 1, "bolt steel", "sku1"),
    pack("p2", 2, "copper wire roll", null, "4"),
    pack("p9", 9, "lonely carton", null),
  ];
  const plan = buildHarmonizePlan(invs, packs);
  assert.deepEqual(plan.slots.map((s) => s.sequence), [1, 2, 3, 4]);
  assert.equal(plan.matchCount, 2);
  assert.equal(plan.unmatchedInvoiceCount, 1);
  assert.equal(plan.unmatchedPackingCount, 1);
  assert.equal(plan.slots[0].status, "ready_for_hs_suggestion");
  assert.equal(plan.slots[1].status, "needs_information");
  assert.deepEqual(plan.slots[1].missingInfo, ["quantity_mismatch_between_sources"]);
  assert.deepEqual(plan.slots[2].missingInfo, ["no_packing_list_match"]);
  assert.deepEqual(plan.slots[3].missingInfo, ["no_invoice_match"]);
  const again = buildHarmonizePlan(invs, packs);
  assert.equal(again.planKey, plan.planKey, "same lines => same key");
  const changed = buildHarmonizePlan([...invs, inv("i4", 4, "More", null)], packs);
  assert.notEqual(changed.planKey, plan.planKey, "different lines => different key");
});

await test("chunk / sequenceRange / mapWithConcurrency", async () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 6), []);
  assert.deepEqual(chunk([1, 2], 0), [[1], [2]]);
  assert.deepEqual(sequenceRange(0), []);
  assert.deepEqual(sequenceRange(3), [1, 2, 3]);
  assert.deepEqual(sequenceRange(Number.NaN), []);
  let inFlight = 0;
  let peak = 0;
  const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return n * 2;
  });
  assert.deepEqual(out, [2, 4, 6, 8, 10, 12, 14]);
  assert.ok(peak <= 3 && peak >= 2, `peak ${peak}`);
});

/* --------------------------------- the job --------------------------------- */

const SUMMARY: HarmonizeSummary = {
  productCount: 14, matchCount: 10, unmatchedInvoiceCount: 2, unmatchedPackingCount: 2, vddMatchTotal: 7,
};

type Script = {
  total?: number;
  /** sequences that return ok:false this many times before succeeding */
  slotFailures?: Record<number, number>;
  /** whole-request failures for the products action, in order of calls (error or null) */
  productRequestErrors?: (HarmonizeApiError | null)[];
  vddFailures?: Record<number, number>;
  needsReview?: number[];
  vddMatchesPerProduct?: number;
};

function makeApi(script: Script = {}) {
  const total = script.total ?? 14;
  const calls = { start: 0, products: [] as number[][], vdd: [] as number[][], finalize: 0 };
  const created = new Set<number>();
  const slotFails = { ...(script.slotFailures ?? {}) };
  const vddFails = { ...(script.vddFailures ?? {}) };
  const reqErrors = [...(script.productRequestErrors ?? [])];
  const api: HarmonizeApi = {
    async start() {
      calls.start++;
      return { planKey: "k1", total, matchCount: 10, unmatchedInvoiceCount: 2, unmatchedPackingCount: 2 };
    },
    async products(planKey, sequences) {
      assert.equal(planKey, "k1");
      calls.products.push([...sequences]);
      const err = reqErrors.length > 0 ? reqErrors.shift() : null;
      if (err) throw err;
      return sequences.map((sequence): ProductBatchResult => {
        if ((slotFails[sequence] ?? 0) > 0) {
          slotFails[sequence]--;
          return { sequence, ok: false, error: `slot ${sequence} exploded` };
        }
        created.add(sequence);
        return {
          sequence, ok: true, reused: false,
          status: (script.needsReview ?? []).includes(sequence) ? "needs_information" : "ready_for_hs_suggestion",
        };
      });
    },
    async vdd(sequences) {
      calls.vdd.push([...sequences]);
      return sequences.map((sequence): VddBatchResult => {
        if ((vddFails[sequence] ?? 0) > 0) {
          vddFails[sequence]--;
          return { sequence, ok: false, error: `vdd ${sequence} failed` };
        }
        return { sequence, ok: true, matchCount: script.vddMatchesPerProduct ?? 1 };
      });
    },
    async finalize(planKey) {
      assert.equal(planKey, "k1");
      calls.finalize++;
      return { ...SUMMARY, productCount: total };
    },
  };
  return { api, calls, created };
}

function newJob(api: HarmonizeApi, extra: { now?: () => number } = {}) {
  const snaps: JobSnapshot[] = [];
  const job = new HarmonizeJob(api, {
    onUpdate: (s) => snaps.push(s),
    sleep: async () => {},
    ...extra,
  });
  return { job, snaps };
}

await test("job: 14 products run in batches of 6, counts are real", async () => {
  const { api, calls } = makeApi({ needsReview: [2, 9] });
  const { job, snaps } = newJob(api);
  const final = await job.run();
  assert.equal(final.status, "success");
  assert.deepEqual(calls.products, [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12], [13, 14]]);
  assert.deepEqual(calls.vdd, [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [11, 12, 13, 14]]);
  assert.equal(calls.start, 1);
  assert.equal(calls.finalize, 1);
  assert.equal(final.ready, 12);
  assert.equal(final.needsReview, 2);
  assert.equal(final.productFailures.length, 0);
  assert.equal(final.vddHits, 14);
  assert.equal(final.summary?.productCount, 14);
  assert.equal(final.stage, "finalizing");

  // progress in the products stage only ever goes up and reaches the total
  const productsSnaps = snaps.filter((s) => s.stage === "products");
  const processed = productsSnaps.map((s) => s.stageProcessed);
  assert.deepEqual([...processed].sort((a, b) => a - b), processed, "monotonic");
  assert.equal(processed.at(-1), 14);
  assert.ok(productsSnaps.every((s) => s.stageProcessed <= s.stageTotal));
  // never claims success before finalize returned
  assert.ok(snaps.filter((s) => s.status === "success").every((s) => s.summary !== null));
});

await test("job: a failed slot is retried once and then succeeds", async () => {
  const { api, calls } = makeApi({ slotFailures: { 3: 1 } });
  const { job } = newJob(api);
  const final = await job.run();
  assert.equal(final.status, "success");
  assert.equal(final.productFailures.length, 0);
  assert.equal(final.ready, 14);
  assert.deepEqual(calls.products[1], [3], "only the failed product was retried");
});

await test("job: persistent failure => partial, Retry failed completes without redoing others", async () => {
  const { api, calls, created } = makeApi({ slotFailures: { 5: 2 } });
  const { job } = newJob(api);
  const partial = await job.run();
  assert.equal(partial.status, "partial");
  assert.deepEqual(partial.productFailures, [{ sequence: 5, error: "slot 5 exploded" }]);
  assert.equal(partial.ready, 13);
  assert.equal(calls.vdd.length, 0, "no VDD/finalize while products are missing");
  assert.equal(calls.finalize, 0);
  assert.equal(created.has(5), false);

  const productCallsBefore = calls.products.length;
  const final = await job.retryFailed();
  assert.equal(final.status, "success");
  assert.deepEqual(calls.products.slice(productCallsBefore), [[5]]);
  assert.equal(final.ready, 14);
  assert.equal(final.productFailures.length, 0);
  assert.equal(calls.start, 1, "plan is not restarted");
  assert.equal(calls.finalize, 1);
  assert.equal(calls.vdd.flat().length, 14, "each product searched exactly once");
});

await test("job: request-level error is retried once, then the batch fails", async () => {
  const net = () => new HarmonizeApiError("Network error. Check your connection.");
  // batch 1 fails twice (initial + retry), the rest succeed
  const { api, calls } = makeApi({ productRequestErrors: [net(), net()] });
  const { job } = newJob(api);
  const partial = await job.run();
  assert.equal(partial.status, "partial");
  assert.deepEqual(partial.productFailures.map((f) => f.sequence), [1, 2, 3, 4, 5, 6]);
  assert.equal(calls.products.length, 4); // batch1 x2, batch2, batch3
  const final = await job.retryFailed();
  assert.equal(final.status, "success");
});

await test("job: one transient request error is absorbed by the retry", async () => {
  const { api } = makeApi({ productRequestErrors: [new HarmonizeApiError("boom", 503)] });
  const { job } = newJob(api);
  const final = await job.run();
  assert.equal(final.status, "success");
  assert.equal(final.productFailures.length, 0);
});

await test("job: 3 request failures in a row abort the run", async () => {
  const net = () => new HarmonizeApiError("Network error");
  const { api, calls } = makeApi({
    total: 60,
    productRequestErrors: Array.from({ length: 20 }, net),
  });
  const { job } = newJob(api);
  const final = await job.run();
  assert.equal(final.status, "failed");
  assert.match(final.fatalError ?? "", /failed requests in a row/);
  assert.equal(calls.products.length, 6, "3 batches x (try + retry)");
  assert.equal(calls.finalize, 0);
});

await test("job: 401 is fatal at once, batch stays queued, resume finishes", async () => {
  const { api, calls } = makeApi({ productRequestErrors: [new HarmonizeApiError("Unauthorized", 401)] });
  const { job } = newJob(api);
  const failedSnap = await job.run();
  assert.equal(failedSnap.status, "failed");
  assert.equal(failedSnap.fatalError, "Unauthorized");
  assert.equal(calls.products.length, 1, "no retry for 401");
  const final = await job.run();
  assert.equal(final.status, "success");
  assert.equal(final.ready, 14);
  assert.equal(calls.start, 1);
  assert.equal(calls.products[1][0], 1, "first batch was redone, not skipped");
});

await test("job: stop after the current batch, then resume without repeats", async () => {
  const { api, calls } = makeApi();
  const { job } = newJob(api);
  const original = api.products;
  api.products = async (k, seqs) => {
    const r = await original(k, seqs);
    if (calls.products.length === 1) job.requestStop();
    return r;
  };
  const stopped = await job.run();
  assert.equal(stopped.status, "stopped");
  assert.equal(calls.products.length, 1);
  assert.equal(stopped.ready, 6);
  assert.equal(calls.finalize, 0);
  const final = await job.run();
  assert.equal(final.status, "success");
  assert.deepEqual(calls.products.flat().sort((a, b) => a - b), sequenceRangeAll(14), "each product requested once");
  assert.equal(final.ready, 14);
});
function sequenceRangeAll(n: number) { return sequenceRange(n); }

await test("job: VDD failures are not fatal; Retry failed adds the new hits", async () => {
  const { api } = makeApi({ vddFailures: { 4: 1 }, vddMatchesPerProduct: 1 });
  const { job } = newJob(api);
  const final = await job.run();
  assert.equal(final.status, "success");
  assert.equal(final.vddFailures.length, 1);
  assert.equal(final.summary?.vddMatchTotal, 7);
  const retried = await job.retryFailed();
  assert.equal(retried.status, "success");
  assert.equal(retried.vddFailures.length, 0);
  assert.equal(retried.summary?.vddMatchTotal, 8);
});

await test("job: server forgetting a sequence counts as failed, never done", async () => {
  const { api } = makeApi({ total: 3 });
  api.products = async (_k, seqs) => [{ sequence: seqs[0], ok: true, status: "ready_for_hs_suggestion" }];
  const { job } = newJob(api);
  const partial = await job.run();
  assert.equal(partial.status, "partial");
  // 1 ok in the batch; 2 and 3 are retried once and the retry only answers for 2
  assert.equal(partial.ready, 2);
  assert.deepEqual(partial.productFailures.map((f) => f.sequence), [3]);
});

await test("display helpers: percent, elapsed, ETA, duration never NaN", () => {
  assert.equal(percentOf(0, 0), 0);
  assert.equal(percentOf(5, 0), 0);
  assert.equal(percentOf(Number.NaN, 10), 0);
  assert.equal(percentOf(1, 3), 33);
  assert.equal(percentOf(99, 100), 99);
  assert.equal(percentOf(999, 1000), 99, "never rounds up to 100 early");
  assert.equal(percentOf(10, 10), 100);
  assert.equal(percentOf(12, 10), 100);
  assert.equal(formatDuration(Number.NaN), "0s");
  assert.equal(formatDuration(-5), "0s");
  assert.equal(formatDuration(42_000), "42s");
  assert.equal(formatDuration(187_000), "3m 07s");
  assert.equal(formatDuration(3_720_000), "1h 02m");

  const base: JobSnapshot = {
    status: "running", stage: "products", total: 100, stageProcessed: 0, stageTotal: 100, stageBaseline: 0,
    stageStartedAt: 1_000, ready: 0, needsReview: 0, productFailures: [], vddFailures: [], vddHits: 0,
    accumulatedMs: 5_000, segmentStartedAt: 1_000, summary: null, fatalError: null,
  };
  assert.equal(elapsedMs(base, 11_000), 15_000);
  assert.equal(etaMs(base, 2_000), null, "no data yet");
  assert.equal(etaMs({ ...base, stageProcessed: 2 }, 20_000), null, "too few items");
  assert.equal(etaMs({ ...base, stageProcessed: 10 }, 2_000), null, "too little time");
  assert.equal(etaMs({ ...base, stageProcessed: 10 }, 11_000), 90_000, "10 items in 10s => 90 left at 1/s");
  assert.equal(etaMs({ ...base, stageProcessed: 100 }, 99_000), null, "nothing left");
  assert.equal(etaMs({ ...base, status: "stopped", stageProcessed: 10 }, 11_000), null);
  assert.equal(etaMs({ ...base, stage: "preparing", stageTotal: 0 }, 11_000), null);
  // resumed stage: only items done since the stage restarted count for the speed
  assert.equal(etaMs({ ...base, stageBaseline: 50, stageProcessed: 60 }, 11_000), 40_000);
});

/* ------------------------------- smoke render ------------------------------- */

function assertCleanHtml(html: string, label: string) {
  assert.ok(html.length > 50, `${label}: rendered`);
  assert.ok(!/NaN/.test(html), `${label}: no NaN`);
  assert.ok(!/undefined/.test(html), `${label}: no undefined`);
  assert.ok(!/null/.test(html.replace(/aria-current="null"/g, "")), `${label}: no null`);
  assert.ok(!/shadow-/.test(html), `${label}: no shadow- classes`);
}

await test("smoke: Pagination renders (many pages, one page, empty)", () => {
  const noop = () => {};
  const many = renderToStaticMarkup(
    createElement(Pagination, {
      bounds: getPageBounds(112, 3, 25), onPageChange: noop, onPageSizeChange: noop,
      itemLabel: "invoice lines", note: "Bulk review actions apply to all 112 invoice lines (every page), not only this page.",
    }),
  );
  assertCleanHtml(many, "many");
  assert.ok(many.includes("Showing 51\u201375 of 112 invoice lines"));
  assert.ok(many.includes('aria-current="page"'));
  assert.ok(many.includes('aria-label="Next page"') && many.includes("Rows per page"));
  for (const size of [10, 25, 50, 100]) assert.ok(many.includes(`>${size}</option>`));
  assert.ok(many.includes("Bulk review actions apply to all 112"));

  const few = renderToStaticMarkup(
    createElement(Pagination, { bounds: getPageBounds(7, 1, 25), onPageChange: noop, onPageSizeChange: noop }),
  );
  assertCleanHtml(few, "few");
  assert.ok(few.includes("Showing 1\u20137 of 7 lines"));
  assert.ok(!few.includes("Rows per page"), "no controls for a single short page");

  const empty = renderToStaticMarkup(
    createElement(Pagination, { bounds: getPageBounds(0, 1, 25), onPageChange: noop, onPageSizeChange: noop }),
  );
  assert.equal(empty, "");
});

await test("smoke: progress dialog content for every state", async () => {
  const base: JobSnapshot = {
    status: "running", stage: "products", total: 112, stageProcessed: 36, stageTotal: 112, stageBaseline: 0,
    stageStartedAt: 10_000, ready: 30, needsReview: 5, productFailures: [{ sequence: 12, error: "AI timed out" }],
    vddFailures: [], vddHits: 0, accumulatedMs: 0, segmentStartedAt: 10_000, summary: null, fatalError: null,
  };
  const now = 40_000;
  const running = renderToStaticMarkup(createElement(HarmonizeProgressContent, { snapshot: base, now }));
  assertCleanHtml(running, "running");
  assert.ok(running.includes('role="progressbar"') && running.includes('aria-valuenow="32"'));
  assert.ok(running.includes("36 of 112 products processed"));
  assert.ok(running.includes('aria-live="polite"'));
  assert.ok(running.includes("Elapsed 30s"));
  assert.ok(running.includes("left in this stage"), "ETA shown once there is data");
  assert.ok(running.includes("Needs review") && running.includes("Failed") && running.includes("Done"));
  assert.ok(running.includes("Product #12") && running.includes("AI timed out"));

  const early = renderToStaticMarkup(createElement(HarmonizeProgressContent, {
    snapshot: { ...base, stageProcessed: 1, productFailures: [], ready: 1, needsReview: 0 }, now: 11_000 }));
  assertCleanHtml(early, "early");
  assert.ok(early.includes("estimating time left"), "no ETA before enough data");

  const preparing = renderToStaticMarkup(createElement(HarmonizeProgressContent, {
    snapshot: { ...base, stage: "preparing", total: 0, stageTotal: 0, stageProcessed: 0, ready: 0, needsReview: 0, productFailures: [] }, now }));
  assertCleanHtml(preparing, "preparing");
  assert.ok(!preparing.includes("aria-valuenow"), "indeterminate bar has no fake value");

  const vdd = renderToStaticMarkup(createElement(HarmonizeProgressContent, {
    snapshot: { ...base, stage: "vdd", stageProcessed: 20, stageTotal: 112, productFailures: [] }, now }));
  assertCleanHtml(vdd, "vdd");
  assert.ok(vdd.includes("20 of 112 products searched for VDD matches"));

  const { api } = makeApi();
  const { job } = newJob(api);
  const done = await job.run();
  const success = renderToStaticMarkup(createElement(HarmonizeProgressContent, { snapshot: done, now }));
  assertCleanHtml(success, "success");
  assert.ok(success.includes('aria-valuenow="100"'));
  assert.ok(success.includes("14 of 14 products processed"));
  assert.ok(success.includes("Created 14 harmonized product(s)"));

  const partial = renderToStaticMarkup(createElement(HarmonizeProgressContent, {
    snapshot: { ...base, status: "partial", segmentStartedAt: null, accumulatedMs: 61_000 }, now }));
  assertCleanHtml(partial, "partial");
  assert.ok(partial.includes("Some products failed") && partial.includes("Elapsed 1m 01s"));

  const failedHtml = renderToStaticMarkup(createElement(HarmonizeProgressContent, {
    snapshot: { ...base, status: "failed", fatalError: "Unauthorized", productFailures: [] }, now }));
  assertCleanHtml(failedHtml, "failed");
  assert.ok(failedHtml.includes('role="alert"') && failedHtml.includes("Unauthorized"));

  const banner = renderToStaticMarkup(createElement(HarmonizeProgressBanner, { snapshot: base, onShow: () => {} }));
  assertCleanHtml(banner, "banner");
  assert.ok(banner.includes("36 of 112 (32%)") && banner.includes("Show progress"));
});

  /* ------------------------------ classification job ------------------------------ */

  type ClassifyScript = {
    sequences?: number[];
    slotFailures?: Record<number, number>;
    requestErrors?: (HarmonizeApiError | null)[];
    needsReview?: number[];
    skipped?: number[];
    viaReference?: number[];
    finalizeError?: HarmonizeApiError;
  };

  function makeClassifyApi(script: ClassifyScript = {}) {
    const sequences = script.sequences ?? [2, 3, 4, 6, 7, 8, 9, 11, 12, 13];
    const calls = { start: 0, products: [] as number[][], finalize: 0 };
    const slotFails = { ...(script.slotFailures ?? {}) };
    const reqErrors = [...(script.requestErrors ?? [])];
    const api: ClassifyApi = {
      async start() {
        calls.start++;
        return { planKey: "c1", total: sequences.length, sequences, referencePopulated: true };
      },
      async products(planKey, seqs) {
        assert.equal(planKey, "c1");
        calls.products.push([...seqs]);
        const err = reqErrors.length > 0 ? reqErrors.shift() : null;
        if (err) throw err;
        return seqs.map((sequence): ClassifyBatchResult => {
          if ((slotFails[sequence] ?? 0) > 0) {
            slotFails[sequence]--;
            return { sequence, ok: false, error: `ai ${sequence} timed out` };
          }
          return {
            sequence,
            ok: true,
            outcome: (script.skipped ?? []).includes(sequence)
              ? "skipped"
              : (script.needsReview ?? []).includes(sequence)
                ? "needs_review"
                : "classified",
            viaReference: (script.viaReference ?? []).includes(sequence),
          };
        });
      },
      async finalize(planKey) {
        assert.equal(planKey, "c1");
        calls.finalize++;
        if (script.finalizeError) throw script.finalizeError;
        return {
          classifiedCount: sequences.length - (script.needsReview ?? []).length - (script.skipped ?? []).length,
          needsReviewCount: (script.needsReview ?? []).length,
          skippedCount: (script.skipped ?? []).length,
          referencePopulated: true,
        } satisfies ClassifySummary;
      },
    };
    return { api, calls, sequences };
  }

  function newClassifyJob(api: ClassifyApi) {
    const snaps: ClassifySnapshot[] = [];
    const job = new ClassifyJob(api, { onUpdate: (x) => snaps.push(x), sleep: async () => {} });
    return { job, snaps };
  }

  await test("classify job: shares the batch engine with harmonization", () => {
    const { api } = makeClassifyApi();
    assert.ok(new ClassifyJob(api) instanceof BatchJobBase);
    assert.ok(new HarmonizeJob(makeApi().api) instanceof BatchJobBase);
  });

  await test("classify job: batches of 4 over the real sequences, counts are real", async () => {
    const { api, calls, sequences } = makeClassifyApi({
      needsReview: [4, 12], skipped: [13], viaReference: [2, 3, 6, 12],
    });
    const { job, snaps } = newClassifyJob(api);
    const final = await job.run();
    assert.equal(final.status, "success");
    assert.deepEqual(calls.products, [[2, 3, 4, 6], [7, 8, 9, 11], [12, 13]]);
    assert.equal(calls.start, 1);
    assert.equal(calls.finalize, 1);
    assert.equal(final.total, sequences.length);
    assert.equal(final.classified, 7);
    assert.equal(final.needsReview, 2);
    assert.equal(final.skipped, 1);
    assert.equal(final.viaReference, 4);
    assert.equal(final.failures.length, 0);
    assert.equal(final.summary?.classifiedCount, 7);
    const classifying = snaps.filter((x) => x.stage === "classifying");
    const processed = classifying.map((x) => x.stageProcessed);
    assert.deepEqual([...processed].sort((a, b) => a - b), processed, "monotonic");
    assert.equal(processed.at(-1), 10);
    assert.ok(snaps.filter((x) => x.status === "success").every((x) => x.summary !== null));
  });

  await test("classify job: failed product retried once, then succeeds", async () => {
    const { api, calls } = makeClassifyApi({ slotFailures: { 7: 1 } });
    const { job } = newClassifyJob(api);
    const final = await job.run();
    assert.equal(final.status, "success");
    assert.equal(final.failures.length, 0);
    assert.deepEqual(calls.products[2], [7], "only the failed product was retried");
  });

  await test("classify job: persistent failure => partial; Retry failed redoes only it", async () => {
    const { api, calls } = makeClassifyApi({ slotFailures: { 8: 2 } });
    const { job } = newClassifyJob(api);
    const partial = await job.run();
    assert.equal(partial.status, "partial");
    assert.deepEqual(partial.failures, [{ sequence: 8, error: "ai 8 timed out" }]);
    assert.equal(partial.classified, 9);
    assert.equal(calls.finalize, 0, "no finalize while products are missing");
    const before = calls.products.length;
    const final = await job.retryFailed();
    assert.equal(final.status, "success");
    assert.deepEqual(calls.products.slice(before), [[8]]);
    assert.equal(final.classified, 10);
    assert.equal(calls.start, 1);
    assert.equal(calls.finalize, 1);
    assert.deepEqual(calls.products.flat().sort((a, b) => a - b), [2, 3, 4, 6, 7, 8, 8, 8, 9, 11, 12, 13]);
  });

  await test("classify job: request error retried once; 3 in a row abort; 409 is fatal and resumable", async () => {
    const net = () => new HarmonizeApiError("Network error", undefined);
    const one = makeClassifyApi({ requestErrors: [new HarmonizeApiError("boom", 503)] });
    const r1 = await newClassifyJob(one.api).job.run();
    assert.equal(r1.status, "success");

    const twice = makeClassifyApi({ requestErrors: [net(), net()] });
    const j2 = newClassifyJob(twice.api).job;
    const r2 = await j2.run();
    assert.equal(r2.status, "partial");
    assert.deepEqual(r2.failures.map((x) => x.sequence), [2, 3, 4, 6]);
    assert.equal((await j2.retryFailed()).status, "success");

    const dead = makeClassifyApi({ sequences: Array.from({ length: 40 }, (_, i) => i + 1), requestErrors: Array.from({ length: 20 }, net) });
    const r3 = await newClassifyJob(dead.api).job.run();
    assert.equal(r3.status, "failed");
    assert.match(r3.fatalError ?? "", /failed requests in a row/);
    assert.equal(dead.calls.products.length, 6);
    assert.equal(dead.calls.finalize, 0);

    const changed = makeClassifyApi({ requestErrors: [new HarmonizeApiError("Product set changed", 409)] });
    const j4 = newClassifyJob(changed.api).job;
    const r4 = await j4.run();
    assert.equal(r4.status, "failed");
    assert.equal(changed.calls.products.length, 1, "no retry for 409");
    const r4b = await j4.run();
    assert.equal(r4b.status, "success");
    assert.deepEqual(changed.calls.products[1], [2, 3, 4, 6], "first batch redone, not skipped");
  });

  await test("classify job: stop after the batch, resume without repeats; finalize error is resumable", async () => {
    const { api, calls } = makeClassifyApi();
    const { job } = newClassifyJob(api);
    const original = api.products;
    api.products = async (k, seqs) => {
      const r = await original(k, seqs);
      if (calls.products.length === 1) job.requestStop();
      return r;
    };
    const stopped = await job.run();
    assert.equal(stopped.status, "stopped");
    assert.equal(stopped.classified, 4);
    assert.equal(calls.finalize, 0);
    const final = await job.run();
    assert.equal(final.status, "success");
    assert.deepEqual(calls.products.flat(), [2, 3, 4, 6, 7, 8, 9, 11, 12, 13], "each product requested once");

    const fin = makeClassifyApi({ finalizeError: new HarmonizeApiError("Only 9 of 10 saved", 400) });
    const j = newClassifyJob(fin.api).job;
    const failedFin = await j.run();
    assert.equal(failedFin.status, "failed");
    assert.equal(failedFin.classified, 10);
    assert.equal(fin.calls.products.length, 3);
    await j.run();
    assert.equal(fin.calls.products.length, 3, "resume goes straight to finalize");
  });

  await test("smoke: classification dialog content for every state", async () => {
    const base: ClassifySnapshot = {
      status: "running", stage: "classifying", total: 112, stageProcessed: 40, stageTotal: 112, stageBaseline: 0,
      stageStartedAt: 10_000, accumulatedMs: 0, segmentStartedAt: 10_000, fatalError: null,
      classified: 30, needsReview: 6, skipped: 1, viaReference: 22,
      failures: [{ sequence: 14, error: "OpenRouter timeout" }], summary: null,
    };
    const now = 40_000;
    const running = renderToStaticMarkup(createElement(ClassifyProgressContent, { snapshot: base, now }));
    assertCleanHtml(running, "classify running");
    assert.ok(running.includes('role="progressbar"') && running.includes('aria-valuenow="33"'), "37 of 112 = 33%");
    assert.ok(running.includes("37 of 112 products classified"));
    assert.ok(running.includes('aria-live="polite"') && running.includes("Elapsed 30s"));
    assert.ok(running.includes("left in this stage"));
    for (const label of ["Classified", "Needs review", "Failed", "From reference"]) assert.ok(running.includes(label), label);
    assert.ok(running.includes("Product #14") && running.includes("OpenRouter timeout"));
    assert.ok(running.includes("HS chapter notes"), "stage label mentions chapter notes");
    assert.ok(running.includes("Choosing products") && running.includes("Saving case status"));

    const early = renderToStaticMarkup(createElement(ClassifyProgressContent, {
      snapshot: { ...base, stageProcessed: 1, classified: 1, needsReview: 0, skipped: 0, failures: [] }, now: 11_000 }));
    assertCleanHtml(early, "classify early");
    assert.ok(early.includes("estimating time left"));

    const preparing = renderToStaticMarkup(createElement(ClassifyProgressContent, {
      snapshot: { ...base, stage: "preparing", total: 0, stageTotal: 0, stageProcessed: 0, classified: 0, needsReview: 0, skipped: 0, failures: [] }, now }));
    assertCleanHtml(preparing, "classify preparing");
    assert.ok(!preparing.includes("aria-valuenow"));

    const { api } = makeClassifyApi({ needsReview: [4], viaReference: [2, 3] });
    const done = await newClassifyJob(api).job.run();
    const success = renderToStaticMarkup(createElement(ClassifyProgressContent, { snapshot: done, now }));
    assertCleanHtml(success, "classify success");
    assert.ok(success.includes('aria-valuenow="100"') && success.includes("10 of 10 products classified"));
    assert.ok(success.includes("Classified 9 product(s), 1 need review"));
    assert.ok(success.includes("2 matched from the tariff reference or VDD without AI"));

    const partial = renderToStaticMarkup(createElement(ClassifyProgressContent, {
      snapshot: { ...base, status: "partial", segmentStartedAt: null, accumulatedMs: 125_000 }, now }));
    assertCleanHtml(partial, "classify partial");
    assert.ok(partial.includes("Some products failed") && partial.includes("Elapsed 2m 05s"));

    const failedHtml = renderToStaticMarkup(createElement(ClassifyProgressContent, {
      snapshot: { ...base, status: "failed", fatalError: "Unauthorized", failures: [] }, now }));
    assertCleanHtml(failedHtml, "classify failed");
    assert.ok(failedHtml.includes('role="alert"') && failedHtml.includes("Classification failed"));

    const banner = renderToStaticMarkup(createElement(ClassifyProgressBanner, { snapshot: base, onShow: () => {} }));
    assertCleanHtml(banner, "classify banner");
    assert.ok(banner.includes("37 of 112 (33%)") && banner.includes("Show progress"));
  });

/* ------------------------------ grouping plan + job ------------------------------ */

  const groupInputs: GroupingInput[] = [
    { productId: "a", hsCode: "8471300000", countryOfOriginCode: "CN", unitOfMeasure: "PCS", quantity: "10", snapshot: { customsDutyRate: "5" } },
    { productId: "b", hsCode: "8471300000", countryOfOriginCode: "CN", unitOfMeasure: "PCS", quantity: "2.5", snapshot: { customsDutyRate: "5" } },
    { productId: "c", hsCode: "8471300000", countryOfOriginCode: "CN", unitOfMeasure: "PCS", quantity: "4", snapshot: { customsDutyRate: "10" } },
    { productId: "d", hsCode: "6109100000", countryOfOriginCode: null, unitOfMeasure: null, quantity: null, snapshot: null },
    { productId: "e", hsCode: "6109100000", countryOfOriginCode: "UNK", unitOfMeasure: "PCS", quantity: "abc", snapshot: null },
  ];
  const groupCtx = { caseCountryOfOriginCode: "UNK", procedureCode: "IM4" };

  await test("grouping plan: buckets by HS, origin, procedure, tax profile and unit", () => {
    const plan = buildGroupingPlan(groupInputs, groupCtx);
    assert.equal(plan.productCount, 5);
    assert.deepEqual(plan.groups.map((g) => g.groupCode), ["GRP-001", "GRP-002", "GRP-003"]);
    assert.deepEqual(plan.groups.map((g) => g.sequence), [1, 2, 3]);
    assert.deepEqual(plan.groups[0].productIds, ["a", "b"]);
    assert.equal(plan.groups[0].totalQuantity, 12.5);
    assert.equal(plan.groups[0].groupingReason, "2 product(s), total qty 12.5");
    assert.deepEqual(plan.groups[1].productIds, ["c"], "different duty rate => different tax profile");
    assert.notEqual(plan.groups[0].key.taxProfileHash, plan.groups[1].key.taxProfileHash);
    // d and e fall back to case origin UNK, unit PCS and no snapshot, so they share a bucket
    assert.deepEqual(plan.groups[2].productIds, ["d", "e"]);
    assert.equal(plan.groups[2].key.unitOfMeasure, "PCS");
    assert.equal(plan.groups[2].key.countryOfOriginCode, "UNK");
    assert.equal(plan.groups[2].totalQuantity, 0, "unparseable or missing quantity counts as 0");
    assert.equal(plan.groups[2].key.procedureCode, "IM4");
  });

  await test("grouping plan: key is stable, changes with members, tax hash matches the old rule", () => {
    const a = buildGroupingPlan(groupInputs, groupCtx);
    const b = buildGroupingPlan(groupInputs.map((x) => ({ ...x })), groupCtx);
    assert.equal(a.planKey, b.planKey);
    assert.notEqual(a.planKey, buildGroupingPlan(groupInputs.slice(1), groupCtx).planKey);
    assert.notEqual(a.planKey, buildGroupingPlan(groupInputs, { ...groupCtx, procedureCode: "IM7" }).planKey);
    assert.equal(buildTaxProfileHash([]), createHash("sha256").update("").digest("hex").slice(0, 32));
    assert.equal(buildTaxProfileHash([{ customsDutyRate: null }]), createHash("sha256").update("0").digest("hex").slice(0, 32));
    assert.equal(buildTaxProfileHash([{ customsDutyRate: "5" }, { customsDutyRate: "10" }]), createHash("sha256").update("10|5").digest("hex").slice(0, 32));
    const fallback = buildGroupingPlan([{ ...groupInputs[3] }], { caseCountryOfOriginCode: null, procedureCode: "IM4" });
    assert.equal(fallback.groups[0].key.countryOfOriginCode, "UNK");
    assert.equal(groupCodeFor(12), "GRP-012");
    assert.equal(groupCodeFor(1234), "GRP-1234");
  });

  type GroupScript = {
    total?: number;
    slotFailures?: Record<number, number>;
    requestErrors?: (HarmonizeApiError | null)[];
    finalizeError?: HarmonizeApiError;
  };

  function makeGroupingApi(script: GroupScript = {}) {
    const total = script.total ?? 19;
    const sequences = sequenceRange(total);
    const calls = { start: 0, products: [] as number[][], finalize: 0 };
    const slotFails = { ...(script.slotFailures ?? {}) };
    const reqErrors = [...(script.requestErrors ?? [])];
    const api: GroupingApi = {
      async start() {
        calls.start++;
        return { planKey: "g1", total, sequences, productCount: total * 3 };
      },
      async products(planKey, seqs) {
        assert.equal(planKey, "g1");
        calls.products.push([...seqs]);
        const err = reqErrors.length > 0 ? reqErrors.shift() : null;
        if (err) throw err;
        return seqs.map((sequence): GroupingBatchResult => {
          if ((slotFails[sequence] ?? 0) > 0) {
            slotFails[sequence]--;
            return { sequence, ok: false, error: `write ${sequence} failed` };
          }
          return { sequence, ok: true, productCount: 3, totalQuantity: 10 };
        });
      },
      async finalize(planKey) {
        assert.equal(planKey, "g1");
        calls.finalize++;
        if (script.finalizeError) throw script.finalizeError;
        return { groupCount: total, productCount: total * 3 };
      },
    };
    return { api, calls };
  }

  function newGroupingJob(api: GroupingApi) {
    const snaps: GroupingSnapshot[] = [];
    const job = new GroupingJob(api, { onUpdate: (x) => snaps.push(x), sleep: async () => {} });
    return { job, snaps };
  }

  await test("grouping job: batches of 8, counts are real and monotonic", async () => {
    const { api, calls } = makeGroupingApi();
    const { job, snaps } = newGroupingJob(api);
    assert.ok(job instanceof BatchJobBase);
    const final = await job.run();
    assert.equal(final.status, "success");
    assert.deepEqual(calls.products.map((b) => b.length), [8, 8, 3]);
    assert.equal(calls.start, 1);
    assert.equal(calls.finalize, 1);
    assert.equal(final.total, 19);
    assert.equal(final.productTotal, 57);
    assert.equal(final.groups, 19);
    assert.equal(final.products, 57);
    assert.equal(final.quantity, 190);
    assert.equal(final.failures.length, 0);
    assert.deepEqual(final.summary, { groupCount: 19, productCount: 57 });
    const writing = snaps.filter((x) => x.stage === "writing").map((x) => x.stageProcessed);
    assert.deepEqual([...writing].sort((a, b) => a - b), writing, "monotonic");
    assert.equal(writing.at(-1), 19);
  });

  await test("grouping job: one failed group is retried once; a persistent one => partial, Retry failed redoes only it", async () => {
    const one = makeGroupingApi({ slotFailures: { 5: 1 } });
    const r1 = await newGroupingJob(one.api).job.run();
    assert.equal(r1.status, "success");
    assert.deepEqual(one.calls.products[1], [5], "only the failed group was retried");

    const { api, calls } = makeGroupingApi({ slotFailures: { 9: 2 } });
    const { job } = newGroupingJob(api);
    const partial = await job.run();
    assert.equal(partial.status, "partial");
    assert.deepEqual(partial.failures, [{ sequence: 9, error: "write 9 failed" }]);
    assert.equal(partial.groups, 18);
    assert.equal(calls.finalize, 0, "no finalize while groups are missing");
    const before = calls.products.length;
    const final = await job.retryFailed();
    assert.equal(final.status, "success");
    assert.deepEqual(calls.products.slice(before), [[9]]);
    assert.equal(final.groups, 19);
    assert.equal(calls.start, 1, "plan not rebuilt (old groups are not deleted again)");
    assert.equal(calls.finalize, 1);
  });

  await test("grouping job: request errors, 409 and stop/resume behave like the other jobs", async () => {
    const net = () => new HarmonizeApiError("Network error", undefined);
    const twice = makeGroupingApi({ requestErrors: [net(), net()] });
    const j2 = newGroupingJob(twice.api).job;
    const r2 = await j2.run();
    assert.equal(r2.status, "partial");
    assert.deepEqual(r2.failures.map((x) => x.sequence), sequenceRange(8));
    assert.equal((await j2.retryFailed()).status, "success");

    const dead = makeGroupingApi({ total: 60, requestErrors: Array.from({ length: 20 }, net) });
    const r3 = await newGroupingJob(dead.api).job.run();
    assert.equal(r3.status, "failed");
    assert.match(r3.fatalError ?? "", /failed requests in a row/);
    assert.match(r3.fatalError ?? "", /groups/);
    assert.equal(dead.calls.finalize, 0);

    const changed = makeGroupingApi({ requestErrors: [new HarmonizeApiError("Approved products changed", 409)] });
    const j4 = newGroupingJob(changed.api).job;
    const r4 = await j4.run();
    assert.equal(r4.status, "failed");
    assert.equal(changed.calls.products.length, 1, "no retry for 409");
    assert.equal((await j4.run()).status, "success");
    assert.deepEqual(changed.calls.products[1], sequenceRange(8), "first batch redone, not skipped");

    const { api, calls } = makeGroupingApi();
    const { job } = newGroupingJob(api);
    const original = api.products;
    api.products = async (k, seqs) => {
      const r = await original(k, seqs);
      if (calls.products.length === 1) job.requestStop();
      return r;
    };
    const stopped = await job.run();
    assert.equal(stopped.status, "stopped");
    assert.equal(stopped.groups, 8);
    assert.equal(calls.finalize, 0);
    const final = await job.run();
    assert.equal(final.status, "success");
    assert.deepEqual(calls.products.flat(), sequenceRange(19), "each group requested once");

    const fin = makeGroupingApi({ finalizeError: new HarmonizeApiError("Only 18 of 19 groups saved", 400) });
    const j = newGroupingJob(fin.api).job;
    const failedFin = await j.run();
    assert.equal(failedFin.status, "failed");
    assert.equal(failedFin.groups, 19);
    await j.run();
    assert.equal(fin.calls.products.length, 3, "resume goes straight to finalize");
  });

  await test("grouping job: an empty plan says so instead of showing 0 of 0", async () => {
    const { api } = makeGroupingApi({ total: 0 });
    const final = await newGroupingJob(api).job.run();
    assert.equal(final.status, "failed");
    assert.match(final.fatalError ?? "", /No groups to create/);
  });

  await test("smoke: grouping dialog content for every state", async () => {
    const base: GroupingSnapshot = {
      status: "running", stage: "writing", total: 40, stageProcessed: 16, stageTotal: 40, stageBaseline: 0,
      stageStartedAt: 10_000, accumulatedMs: 0, segmentStartedAt: 10_000, fatalError: null,
      productTotal: 120, groups: 16, products: 48, quantity: 1234.5,
      failures: [{ sequence: 7, error: "deadlock detected" }], summary: null,
    };
    const now = 40_000;
    const running = renderToStaticMarkup(createElement(GroupingProgressContent, { snapshot: base, now }));
    assertCleanHtml(running, "grouping running");
    assert.ok(running.includes('role="progressbar"') && running.includes('aria-valuenow="40"'), "16 of 40 = 40%");
    assert.ok(running.includes("16 of 40 groups created"));
    assert.ok(running.includes('aria-live="polite"') && running.includes("Elapsed 30s"));
    for (const label of ["Groups created", "Products grouped", "Total quantity", "Failed"]) assert.ok(running.includes(label), label);
    assert.ok(running.includes("Group #7") && running.includes("deadlock detected"));
    assert.ok(running.includes("Saving declaration groups"));

    const preparing = renderToStaticMarkup(createElement(GroupingProgressContent, {
      snapshot: { ...base, stage: "preparing", total: 0, stageTotal: 0, stageProcessed: 0, groups: 0, products: 0, quantity: 0, failures: [] }, now }));
    assertCleanHtml(preparing, "grouping preparing");
    assert.ok(!preparing.includes("aria-valuenow"), "indeterminate while the plan is built");

    const { api } = makeGroupingApi({ total: 5 });
    const done = await newGroupingJob(api).job.run();
    const success = renderToStaticMarkup(createElement(GroupingProgressContent, { snapshot: done, now }));
    assertCleanHtml(success, "grouping success");
    assert.ok(success.includes('aria-valuenow="100"') && success.includes("5 of 5 groups created"));
    assert.ok(success.includes("Created 5 declaration group(s) from 15 product(s)"));

    const failedHtml = renderToStaticMarkup(createElement(GroupingProgressContent, {
      snapshot: { ...base, status: "failed", fatalError: "No products approved for declaration", failures: [] }, now }));
    assertCleanHtml(failedHtml, "grouping failed");
    assert.ok(failedHtml.includes('role="alert"') && failedHtml.includes("Grouping failed"));

    const banner = renderToStaticMarkup(createElement(GroupingProgressBanner, { snapshot: base, onShow: () => {} }));
    assertCleanHtml(banner, "grouping banner");
    assert.ok(banner.includes("16 of 40 (40%)") && banner.includes("Show progress"));
  });

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
