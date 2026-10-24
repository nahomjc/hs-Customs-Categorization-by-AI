/**
 * Offline test for the dashboard source-country map: country-code
 * normalisation, generated map data, aggregation helpers, and a static-HTML
 * smoke render of the new components. No database, no browser.
 *
 *   npm run test:dashboard-map
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import mapData from "../components/dashboard/map/world-paths.json";
import {
  DESTINATION_ISO2,
  getCountryMeta,
  normalizeCountryCode,
} from "../lib/country-codes";
import {
  arcPath,
  intensityStep,
  summarizeSourceCountries,
  weeklySeries,
} from "../lib/dashboard-map-utils";
import { SourceCountryMap } from "../components/dashboard/map/SourceCountryMap";
import { DonutChart, DonutLegend } from "../components/dashboard/bento/DonutChart";
import {
  AmountListRow,
  GradientHeroCard,
  KpiProgressTile,
  StatList,
} from "../components/dashboard/bento/DashboardCards";
import { BENTO_COLORS } from "../components/dashboard/bento/charts";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else {
    failed++;
    console.error(`FAIL ${name}`, detail ?? "");
  }
}

/* ---- normalisation ---------------------------------------------------- */
const cases: [string | null | undefined, string | null][] = [
  ["CN", "CN"],
  ["cn", "CN"],
  [" CHN ", "CN"],
  ["chn", "CN"],
  ["ET", "ET"],
  ["ETH", "ET"],
  ["US", "US"],
  ["USA", "US"],
  ["AE", "AE"],
  ["ARE", "AE"],
  ["HK", "HK"],
  ["HKG", "HK"],
  ["SG", "SG"],
  ["SGP", "SG"],
  ["IN", "IN"],
  ["IND", "IN"],
  ["TR", "TR"],
  ["TUR", "TR"],
  ["DE", "DE"],
  ["DEU", "DE"],
  ["GB", "GB"],
  ["GBR", "GB"],
  ["UK", "GB"],
  ["XK", "XK"],
  ["XKX", "XK"],
  ["", null],
  ["  ", null],
  [null, null],
  [undefined, null],
  ["ZZ", null],
  ["ZZZ", null],
  ["China", null],
  ["1", null],
];
for (const [raw, want] of cases) {
  const got = normalizeCountryCode(raw);
  check(`normalize(${JSON.stringify(raw)})`, got === want, { got, want });
}

/* ---- generated map data ----------------------------------------------- */
const shapes = new Set(mapData.paths.map((p) => p.c));
for (const code of ["ET", "CN", "US", "IN", "AE", "TR", "DE", "GB", "FR", "BR", "ZA", "KE", "EG", "JP", "RU", "AU", "SA"]) {
  check(`map has shape ${code}`, shapes.has(code));
}
check("map has many shapes", mapData.paths.length > 150, mapData.paths.length);
check("viewBox sane", mapData.width === 1000 && mapData.height > 300 && mapData.height < 600);
check("paths have no NaN", mapData.paths.every((p) => !p.d.includes("NaN") && p.d.startsWith("M")));
for (const code of ["ET", "CN", "HK", "SG", "AE", "US"]) {
  const m = getCountryMeta(code);
  check(`meta ${code}`, !!m && Number.isFinite(m.x) && Number.isFinite(m.y) && m.x >= 0 && m.x <= 1000 && m.y >= 0 && m.y <= mapData.height, m);
}
check("HK has marker position without shape", getCountryMeta("HK")?.hasShape === false);
check("destination is Ethiopia", getCountryMeta(DESTINATION_ISO2)?.name === "Ethiopia");

/* ---- aggregation ------------------------------------------------------ */
const summary = summarizeSourceCountries([
  { code: "CN", count: 10 },
  { code: "CHN", count: 5 }, // alpha-3 merges into CN
  { code: "AE", count: 6 },
  { code: "HK", count: 3 },
  { code: "TR", count: 1 },
  { code: null, count: 4 },
  { code: "ZZ", count: 2 },
]);
check("merge alpha2+alpha3", summary.countries[0]?.iso2 === "CN" && summary.countries[0].count === 15, summary.countries[0]);
check("total", summary.total === 25, summary.total);
check("unknown", summary.unknownCount === 6, summary.unknownCount);
check("shares sum ~100", Math.abs(summary.countries.reduce((s, c) => s + c.share, 0) - 100) < 1e-9);
check("max", summary.max === 15);
check("intensity", intensityStep(15, 15) === 4 && intensityStep(1, 15) === 1 && intensityStep(8, 15) === 3);
check("arc", (arcPath(777, 140, 606, 229) ?? "").startsWith("M ") && arcPath(606, 229, 610, 230) === null);
const weekly = weeklySeries(
  [
    { code: "CN", weeksAgo: 0, count: 2 },
    { code: "CHN", weeksAgo: 1, count: 3 },
    { code: "CN", weeksAgo: 9, count: 5 },
    { code: "AE", weeksAgo: 0, count: 7 },
  ],
  "CN",
);
check("weekly series", weekly.length === 8 && weekly[7] === 2 && weekly[6] === 3 && weekly.reduce((a, b) => a + b, 0) === 5, weekly);

/* ---- static render ---------------------------------------------------- */
function expectClean(name: string, html: string) {
  check(`${name}: no NaN/undefined/null text`, !/NaN|undefined|\[object/.test(html), html.match(/.{30}(NaN|undefined|\[object).{30}/)?.[0]);
  check(`${name}: no shadow-`, !html.includes("shadow-"));
  check(`${name}: not empty`, html.length > 100);
}

const mapHtml = renderToStaticMarkup(createElement(SourceCountryMap, { summary }));
expectClean("map", mapHtml);
check("map has role img + aria-label", /<svg[^>]*role="img"[^>]*aria-label="World map of 25 import cases/.test(mapHtml));
check("map has focusable markers", (mapHtml.match(/<button type="button"/g) ?? []).length === 4, (mapHtml.match(/<button type="button"/g) ?? []).length);
check("map has sr-only table", mapHtml.includes('<table class="sr-only">'));
check("map has arcs hidden on mobile", mapHtml.includes("max-sm:hidden"));
check("map mentions Ethiopia destination", mapHtml.includes("Destination"));
check("no purple/pink palette", !/#(a855f7|9333ea|7c3aed|ec4899|db2777|f43f5e)/i.test(mapHtml));

const emptyHtml = renderToStaticMarkup(
  createElement(SourceCountryMap, { summary: summarizeSourceCountries([{ code: null, count: 3 }]) }),
);
expectClean("map (empty)", emptyHtml);
check("empty state shown", emptyHtml.includes("No source countries yet") && !emptyHtml.includes("<button"));

const noRowsHtml = renderToStaticMarkup(
  createElement(SourceCountryMap, { summary: summarizeSourceCountries([]) }),
);
expectClean("map (no rows)", noRowsHtml);

const statusRows = [
  { label: "Completed", value: 9, color: BENTO_COLORS.success },
  { label: "In progress", value: 14, color: BENTO_COLORS.brand },
  { label: "Cancelled", value: 2, color: BENTO_COLORS.danger },
];
expectClean(
  "donut",
  renderToStaticMarkup(
    createElement("div", null,
      createElement(DonutChart, { segments: statusRows, centerValue: "25", centerLabel: "Cases", ariaLabel: "Case status" }),
      createElement(DonutLegend, { rows: statusRows }),
    ),
  ),
);
const donutHtml = renderToStaticMarkup(createElement(DonutChart, { segments: statusRows, ariaLabel: "x" }));
check("donut highlights largest (56%)", donutHtml.includes(">56%<"), donutHtml.match(/<text[^>]*>[^<]*/g));
expectClean(
  "donut (zero)",
  renderToStaticMarkup(createElement(DonutChart, { segments: [{ label: "A", value: 0, color: "#000" }], ariaLabel: "x" })),
);
expectClean(
  "hero",
  renderToStaticMarkup(
    createElement(GradientHeroCard, {
      title: "Total import cases",
      value: "25",
      lines: [{ label: "Declared invoice value (USD)", value: "$1,234" }],
      href: "/dashboard/import-cases",
    }),
  ),
);
expectClean("progress tile", renderToStaticMarkup(createElement(KpiProgressTile, { label: "In progress", badgeValue: 14, percent: 56, caption: "56% of all cases" })));
expectClean(
  "stat list",
  renderToStaticMarkup(
    createElement(StatList, {
      trendLabel: "cases per week",
      rows: [
        { key: "a", label: "China", value: "15 cases", series: [0, 1, 3, 2, 0, 4, 3, 2], color: "#007bff" },
        { key: "b", label: "Turkey", value: "1 case", series: [0, 0, 0, 0, 0, 0, 0, 0], percent: 4, color: "#6366f1" },
      ],
    }),
  ),
);
expectClean("amount row", renderToStaticMarkup(createElement("ul", null, createElement(AmountListRow, { href: "/x", title: "IC-1", subtitle: "Acme", amount: null }), createElement(AmountListRow, { href: "/y", title: "IC-2", amount: "$5" }))));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);