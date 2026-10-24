/**
 * One-off generator for the dashboard "Cases by source country" map.
 *
 * The generators are NOT project dependencies. Run from a temp folder:
 *   mkdir mapgen; cd mapgen; npm init -y; npm i world-atlas topojson-client d3-geo world-countries
 *   copy this file into mapgen, then:
 *   node generate-world-map.mjs <outDir>
 *
 * Writes (then move them into the project):
 *   world-paths.json        -> components/dashboard/map/world-paths.json (projected SVG paths)
 *   country-codes-data.json -> lib/country-codes-data.json (ISO2/ISO3/name + projected centroid)
 * Sources: world-atlas countries-110m (Natural Earth, public domain),
 *          world-countries (mledoze, ODbL) for ISO codes and centroids.
 */
import { createRequire } from "node:module";
import { writeFileSync, readFileSync } from "node:fs";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const outDir = process.argv[2] ?? ".";
const topo = JSON.parse(readFileSync(require.resolve("world-atlas/countries-110m.json"), "utf8"));
const meta = require("world-countries");

const fc = feature(topo, topo.objects.countries);
const features = fc.features.filter((f) => f.properties.name !== "Antarctica");

const W = 1000;
const projection = geoNaturalEarth1().fitWidth(W, { type: "FeatureCollection", features });
const path = geoPath(projection).digits(1);
const [, [, y1]] = geoPath(projection).bounds({ type: "FeatureCollection", features });
const H = Math.ceil(y1 + 4);

const byNum = new Map(meta.filter((c) => c.ccn3).map((c) => [c.ccn3, c]));
// Natural Earth shapes without an ISO numeric id.
const byName = new Map([
  ["Kosovo", meta.find((c) => c.cca2 === "XK")],
  ["Somaliland", meta.find((c) => c.cca2 === "SO")],
  ["N. Cyprus", meta.find((c) => c.cca2 === "CY")],
]);

const paths = [];
const used = new Set();
for (const f of features) {
  const m = (f.id && byNum.get(String(f.id).padStart(3, "0"))) || byName.get(f.properties.name);
  const d = path(f);
  if (!d || !m) continue;
  used.add(m.cca2);
  paths.push({ c: m.cca2, d });
}

const countries = meta
  .filter((c) => c.cca2 && c.cca3 && c.latlng?.length === 2 && c.cca2 !== "AQ")
  .map((c) => {
    const p = projection([c.latlng[1], c.latlng[0]]);
    return [c.cca2, c.cca3, c.name.common, +p[0].toFixed(1), +p[1].toFixed(1), used.has(c.cca2) ? 1 : 0];
  })
  .sort((a, b) => a[0].localeCompare(b[0]));

writeFileSync(`${outDir}/world-paths.json`, JSON.stringify({ width: W, height: H, paths }));
writeFileSync(`${outDir}/country-codes-data.json`, JSON.stringify({ countries }));
console.log("paths", paths.length, "countries", countries.length, "viewBox", W, H);