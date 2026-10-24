/**
 * Offline test for the client "My shipments" search, paging, URL state, route
 * map geometry, flags and a static render of the cards. No database/browser.
 *
 *   npm run test:my-shipments
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ClientShipmentSummary } from "../components/dashboard/client/ClientShipmentCard";
import { MyShipmentsView } from "../components/dashboard/client/MyShipmentsView";
import { ShipmentCard } from "../components/dashboard/client/ShipmentCard";
import countries from "../lib/country-codes-data.json";
import { getPageBounds } from "../lib/import-cases/pagination";
import { FLAG_CODES, hasFlag } from "../lib/shipments/flag-codes";
import {
  CARD_MAP_ASPECT,
  WORLD_MAP_H,
  WORLD_MAP_W,
  routeArc,
  routeViewBox,
} from "../lib/shipments/route-map";
import {
  formatShipmentAmount,
  formatShipmentDate,
  resolveOriginCountry,
  transportDocument,
} from "../lib/shipments/shipment-format";
import {
  DEFAULT_SHIPMENT_PAGE_SIZE,
  buildShipmentHaystack,
  buildShipmentListUrl,
  filterShipments,
  matchesQuery,
  normalizeSearchText,
  parseShipmentListParams,
  parseShipmentView,
} from "../lib/shipments/shipment-search";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

function make(i: number, over: Partial<ClientShipmentSummary> = {}): ClientShipmentSummary {
  return {
    id: `id-${i}`,
    caseNumber: `IC-2026-${String(i).padStart(4, "0")}`,
    trackingStatus: "classification",
    trackingNote: null,
    trackingUpdatedAt: new Date("2026-10-20T10:00:00Z"),
    supplierName: null,
    shipmentReference: null,
    updatedAt: new Date("2026-10-21T10:00:00Z"),
    createdAt: new Date("2026-09-01T10:00:00Z"),
    supplierCountryCode: null,
    countryOfExportCode: null,
    countryOfOriginCode: null,
    billOfLadingNumber: null,
    airwayBillNumber: null,
    incoterm: null,
    invoiceCurrencyCode: null,
    invoiceTotalAmount: null,
    productCount: 0,
    productNames: [],
    ...over,
  };
}

const data: ClientShipmentSummary[] = [
  make(1, { supplierName: "Shenzhen Tech Co.", countryOfExportCode: "CN", shipmentReference: "INV-2024/001", invoiceCurrencyCode: "USD", invoiceTotalAmount: "12500.5", productCount: 3, productNames: ["LED Panel Lights", "Café Grinder"], incoterm: "CIF", billOfLadingNumber: "BL778899" }),
  make(2, { supplierName: "Mumbai Textiles", supplierCountryCode: "IND", trackingStatus: "customs_clearance", airwayBillNumber: "AWB-55" }),
  make(3, { supplierName: "Unknown Origin Ltd", trackingStatus: "delivered", trackingNote: "Released by customs" }),
  make(4, { supplierName: "Dubai Trading", countryOfOriginCode: "AE", trackingStatus: "documents_in_progress" }),
  make(5, { countryOfExportCode: "ZZ", supplierCountryCode: "TR" }),
];
const haystacks = data.map(buildShipmentHaystack);
const search = (q: string) => filterShipments(data, haystacks, q).map((s) => s.caseNumber);

test("search: reference, supplier, status, country name/code, product, notes", () => {
  assert.deepEqual(search("IC-2026-0001"), ["IC-2026-0001"]);
  assert.deepEqual(search("shenzhen"), ["IC-2026-0001"]);
  assert.deepEqual(search("customs clearance"), ["IC-2026-0002"]);
  assert.deepEqual(search("delivered"), ["IC-2026-0003"]);
  assert.deepEqual(search("china"), ["IC-2026-0001"]);
  assert.deepEqual(search("CN"), ["IC-2026-0001"]);
  assert.deepEqual(search("india"), ["IC-2026-0002"], "alpha-3 IND on the case resolves to India");
  assert.deepEqual(search("emirates"), ["IC-2026-0004"], "falls back to country of origin");
  assert.deepEqual(search("led panel"), ["IC-2026-0001"]);
  assert.deepEqual(search("bl778899"), ["IC-2026-0001"]);
  assert.deepEqual(search("awb-55"), ["IC-2026-0002"]);
  assert.deepEqual(search("cif"), ["IC-2026-0001"]);
  assert.deepEqual(search("released"), ["IC-2026-0003"]);
});

test("search: AND of words, accents, case, punctuation-insensitive, empty = all", () => {
  assert.deepEqual(search("china usd"), ["IC-2026-0001"]);
  assert.deepEqual(search("china india"), []);
  assert.deepEqual(search("CAFE"), ["IC-2026-0001"], "accents ignored");
  assert.deepEqual(search("  SHENZHEN   tech "), ["IC-2026-0001"]);
  assert.deepEqual(search("inv2024001"), ["IC-2026-0001"], "punctuation ignored");
  assert.equal(search("").length, 5);
  assert.equal(search("   ").length, 5);
  assert.deepEqual(search("nothing like this"), []);
  assert.equal(normalizeSearchText("  Café   Ñandú "), "cafe nandu");
  assert.ok(matchesQuery(haystacks[0], "led"));
});

test("origin: export, then supplier, then origin; unknown codes are skipped, never invented", () => {
  assert.equal(resolveOriginCountry(data[0])?.iso2, "CN");
  assert.equal(resolveOriginCountry(data[1])?.iso2, "IN");
  assert.equal(resolveOriginCountry(data[3])?.iso2, "AE");
  assert.equal(resolveOriginCountry(data[4])?.iso2, "TR", "ZZ is not a country, so the supplier country is used");
  assert.equal(resolveOriginCountry(data[2]), null, "no country data => null");
  assert.equal(resolveOriginCountry({ countryOfExportCode: "ET" })?.name, "Ethiopia");
});

test("format: dates are fixed-locale, amounts and documents only when real", () => {
  assert.equal(formatShipmentDate("2026-10-24T12:00:00Z"), "24 Oct 2026");
  assert.equal(formatShipmentDate("2026-10-24T22:30:00Z"), "25 Oct 2026", "Nairobi time zone (UTC+3)");
  assert.equal(formatShipmentDate(null), null);
  assert.equal(formatShipmentDate("not a date"), null);
  assert.equal(formatShipmentAmount("12500.5", "USD"), "$12,500.50");
  assert.equal(formatShipmentAmount("100", "ETB")?.replace(/\u00a0/g, " "), "ETB 100.00");
  assert.equal(formatShipmentAmount("100", "XXQ")?.replace(/\u00a0/g, " "), "XXQ 100.00", "Intl formats any 3-letter code");
  assert.equal(formatShipmentAmount("100", "US"), "100.00 US", "malformed code falls back to plain number + code");
  assert.equal(formatShipmentAmount("5", null), "5.00");
  assert.equal(formatShipmentAmount(null, "USD"), null);
  assert.equal(formatShipmentAmount("abc", "USD"), null);
  assert.deepEqual(transportDocument(data[0]), { label: "Bill of lading", value: "BL778899" });
  assert.deepEqual(transportDocument(data[1]), { label: "Airway bill", value: "AWB-55" });
  assert.equal(transportDocument(data[2]), null);
});

test("url state: parse is defensive, build leaves defaults out", () => {
  assert.deepEqual(parseShipmentListParams({}), { q: "", page: 1, size: DEFAULT_SHIPMENT_PAGE_SIZE });
  assert.deepEqual(parseShipmentListParams({ q: "china", page: "3", size: "24" }), { q: "china", page: 3, size: 24 });
  assert.deepEqual(parseShipmentListParams({ q: ["a", "b"], page: ["2"] }), { q: "a", page: 2, size: 12 });
  assert.deepEqual(parseShipmentListParams({ page: "-4", size: "7" }), { q: "", page: 1, size: 12 });
  assert.deepEqual(parseShipmentListParams({ page: "abc" }), { q: "", page: 1, size: 12 });
  assert.equal(parseShipmentListParams({ q: "x".repeat(500) }).q.length, 120);
  assert.equal(buildShipmentListUrl("/dashboard/my-shipments", { q: "", page: 1, size: 12 }), "/dashboard/my-shipments");
  assert.equal(buildShipmentListUrl("/p", { q: " china ", page: 2, size: 12 }), "/p?q=china&page=2");
  assert.equal(buildShipmentListUrl("/p", { q: "a b", page: 1, size: 24 }), "/p?q=a+b&size=24");
  const round = parseShipmentListParams(Object.fromEntries(new URL(buildShipmentListUrl("/p", { q: "led & co", page: 4, size: 48 }), "http://x").searchParams));
  assert.deepEqual(round, { q: "led & co", page: 4, size: 48 });
});

test("view: card is the default, only an explicit list switches", () => {
  assert.equal(parseShipmentView(undefined), "card");
  assert.equal(parseShipmentView(null), "card");
  assert.equal(parseShipmentView("garbage"), "card");
  assert.equal(parseShipmentView("card"), "card");
  assert.equal(parseShipmentView("list"), "list");
});

test("paging: slices, clamps a stale page, shows the right range", () => {
  const many = Array.from({ length: 30 }, (_, i) => make(i + 100));
  const b = getPageBounds(many.length, 3, 12);
  assert.equal(b.pageCount, 3);
  assert.deepEqual([b.from, b.to], [25, 30]);
  assert.equal(many.slice(b.start, b.end).length, 6);
  assert.equal(getPageBounds(many.length, 99, 12).page, 3, "page beyond the end is clamped");
  assert.equal(getPageBounds(0, 1, 12).pageCount, 1);
  const filtered = filterShipments(many, many.map(buildShipmentHaystack), "0105");
  assert.equal(filtered.length, 1);
  assert.equal(getPageBounds(filtered.length, 3, 12).page, 1, "a search that shrinks the list returns to page 1");
});

test("route map: view box frames both ends inside the world with a fixed aspect", () => {
  const cn = resolveCoord("CN");
  const et = resolveCoord("ET");
  const vb = routeViewBox(cn, et);
  for (const v of [vb, routeViewBox(resolveCoord("BR"), et), routeViewBox(resolveCoord("NZ"), et), routeViewBox(null, et), routeViewBox(resolveCoord("ER"), et)]) {
    assert.ok(Math.abs(v.w / v.h - CARD_MAP_ASPECT) < 0.01, "fixed aspect");
    assert.ok(v.x >= 0 && v.y >= 0 && v.x + v.w <= WORLD_MAP_W + 0.01 && v.y + v.h <= WORLD_MAP_H + 0.01, "inside the map");
    assert.ok(Number.isFinite(v.x + v.y + v.w + v.h));
  }
  assert.ok(vb.x <= Math.min(cn.x, et.x) && vb.x + vb.w >= Math.max(cn.x, et.x), "contains both countries");
  assert.ok(vb.y <= Math.min(cn.y, et.y), "contains the arc side");
  const noOrigin = routeViewBox(null, et);
  assert.ok(noOrigin.w < vb.w, "no origin = tighter view on Ethiopia");
  assert.equal(routeArc(et, { x: et.x + 2, y: et.y }), null, "no arc for neighbours that overlap");
  assert.match(routeArc(cn, et)?.d ?? "", /^M [\d.]+ [\d.]+ Q [\d.]+ [\d.]+ [\d.]+ [\d.]+$/);
});

function resolveCoord(iso2: string) {
  const row = (countries as { countries: [string, string, string, number, number, number][] }).countries.find((r) => r[0] === iso2);
  assert.ok(row, iso2);
  return { x: row[3], y: row[4] };
}

test("flags: every country has a bundled SVG file and a registry entry", () => {
  const dir = path.join(process.cwd(), "public", "flags");
  const files = new Set(readdirSync(dir).filter((f) => f.endsWith(".svg")).map((f) => f.replace(".svg", "")));
  const codes = (countries as { countries: string[][] }).countries.map((r) => r[0]);
  for (const code of codes) {
    assert.ok(files.has(code), `file for ${code}`);
    assert.ok(hasFlag(code), `registry for ${code}`);
  }
  for (const code of FLAG_CODES) assert.ok(existsSync(path.join(dir, `${code}.svg`)), `registry entry ${code} has a file`);
  assert.equal(hasFlag(null), false);
  assert.equal(hasFlag("ZZ"), false);
  assert.ok(existsSync(path.join(dir, "LICENSE.txt")));
});

function assertClean(html: string, label: string) {
  assert.ok(html.length > 100, `${label}: rendered`);
  assert.ok(!/NaN|undefined/.test(html), `${label}: no NaN/undefined`);
  assert.ok(!/shadow-/.test(html), `${label}: no shadow- classes`);
  // flag emoji are regional-indicator pairs (U+1F1E6..U+1F1FF)
  assert.ok(!/[\u{1F1E6}-\u{1F1FF}]/u.test(html), `${label}: no flag emoji`);
}

test("card: real fields, flag images, map via <use>, honest placeholders", () => {
  const full = renderToStaticMarkup(createElement(ShipmentCard, { shipment: data[0] }));
  assertClean(full, "full card");
  assert.ok(full.includes("IC-2026-0001") && full.includes("Ref \u00b7 INV-2024/001"));
  assert.ok(full.includes("Classification"), "status label");
  assert.ok(full.includes('src="/flags/CN.svg"') && full.includes('src="/flags/ET.svg"'));
  assert.ok(full.includes("China") && full.includes("Ethiopia"));
  assert.ok(full.includes('href="#shp-world"') && full.includes('href="#shp-c-CN"') && full.includes('href="#shp-c-ET"'));
  assert.ok(!full.includes("<path d=\"M9"), "no world path data repeated inside the card");
  assert.ok(full.length < 15_000, `card markup stays small (${full.length} bytes)`);
  assert.ok(full.includes("Shenzhen Tech Co.") && full.includes("$12,500.50") && full.includes("Bill of lading") && full.includes("BL778899") && !full.includes("Incoterm"), "supplier + up to three real facts, never more than four");
  assert.ok(full.includes("Opened 1 Sep 2026") && full.includes("Updated 20 Oct 2026"));
  assert.ok(full.includes('role="img"') && full.includes("route from China to Ethiopia"));

  const bare = renderToStaticMarkup(createElement(ShipmentCard, { shipment: data[2] }));
  assertClean(bare, "no-country card");
  assert.ok(bare.includes("Origin not on file") && bare.includes("Origin country not on file"));
  assert.ok(!bare.includes("/flags/undefined") && !bare.includes("/flags/null"));
  assert.ok(bare.includes("border-dashed"), "neutral placeholder flag");
  assert.ok(bare.includes("No shipment reference yet") && bare.includes("Released by customs"));
  assert.ok(!bare.includes("Invoice total") && !bare.includes("Incoterm"), "missing fields are left out, not invented");
  assert.ok(!bare.includes('href="#shp-c-ZZ"'));
});

test("view: card default, one defs block, search + pagination markup, empty states", () => {
  const many = Array.from({ length: 30 }, (_, i) => make(i + 1, { countryOfExportCode: i % 2 ? "CN" : "DE" }));
  const html = renderToStaticMarkup(createElement(MyShipmentsView, { shipments: many }));
  assertClean(html, "view");
  assert.equal((html.match(/id="shp-world"/g) ?? []).length, 1, "world paths written once");
  assert.equal((html.match(/<article|href="\/dashboard\/my-shipments\/id-/g) ?? []).length, 12, "12 cards on page 1");
  assert.ok(html.includes('aria-pressed="true"'));
  assert.ok(/aria-pressed="true"[^>]*>[^<]*<svg[\s\S]*?<\/svg>Cards/.test(html), "Cards is the active toggle");
  assert.ok(html.includes('type="search"') && html.includes("Search shipments"));
  assert.ok(!html.includes('aria-label="Clear search"'), "no clear button while the box is empty");
  assert.ok(html.includes("Showing 1\u201312 of 30 shipments") && html.includes('aria-label="Next page"'));
  assert.ok(!html.includes("<table"), "no table in card view");

  const list = renderToStaticMarkup(createElement(MyShipmentsView, { shipments: many, initialView: "list" }));
  assertClean(list, "list view");
  assert.ok(list.includes("<table") && list.includes("md:hidden"));

  const page3 = renderToStaticMarkup(createElement(MyShipmentsView, { shipments: many, initialPage: 3, initialPageSize: 12 }));
  assert.ok(page3.includes("Showing 25\u201330 of 30 shipments"));

  const searched = renderToStaticMarkup(createElement(MyShipmentsView, { shipments: many, initialQuery: "germany" }));
  assert.ok(searched.includes("15 of 30 shipments") && searched.includes('aria-label="Clear search"'));

  const none = renderToStaticMarkup(createElement(MyShipmentsView, { shipments: many, initialQuery: "zzzz" }));
  assertClean(none, "no results");
  assert.ok(none.includes("No shipments match your search") && none.includes("Clear search"));
  assert.ok(!none.includes("Showing"), "no pagination for an empty result");

  const empty = renderToStaticMarkup(createElement(MyShipmentsView, { shipments: [] }));
  assert.ok(empty.includes("No shipments yet") && !empty.includes('type="search"'));
});

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);