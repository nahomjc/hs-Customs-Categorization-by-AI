import { memo } from "react";
import mapData from "@/components/dashboard/map/world-paths.json";
import { BENTO_COLORS } from "@/components/dashboard/bento/charts";
import { DESTINATION_ISO2, getCountryMeta } from "@/lib/country-codes";
import {
  formatViewBox,
  routeArc,
  routeViewBox,
} from "@/lib/shipments/route-map";

type WorldMapData = { width: number; height: number; paths: { c: string; d: string }[] };
const WORLD = mapData as WorldMapData;

/** Path data grouped per country, built once at module load. */
const COUNTRY_PATHS: [string, string[]][] = (() => {
  const grouped = new Map<string, string[]>();
  for (const p of WORLD.paths) {
    const list = grouped.get(p.c) ?? [];
    list.push(p.d);
    grouped.set(p.c, list);
  }
  return [...grouped];
})();

const LAND = "#dbe3ee";
const BRAND = BENTO_COLORS.brand;
const DESTINATION = BENTO_COLORS.indigo;
const MARKER = "#0057b8";

const WORLD_ID = "shp-world";
const countryId = (iso2: string) => `shp-c-${iso2}`;

/**
 * The world map's path data, written to the page ONCE. Every card map points
 * at it with <use>, so many cards do not repeat ~110 KB of paths each.
 * Render this once next to the list of cards.
 */
export const ShipmentMapDefs = memo(function ShipmentMapDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={0}
      height={0}
      className="pointer-events-none absolute h-0 w-0 overflow-hidden"
    >
      <defs>
        {COUNTRY_PATHS.map(([iso2, ds]) => (
          <g key={iso2} id={countryId(iso2)}>
            {ds.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        ))}
        <g id={WORLD_ID}>
          {COUNTRY_PATHS.map(([iso2]) => (
            <use key={iso2} href={`#${countryId(iso2)}`} />
          ))}
        </g>
      </defs>
    </svg>
  );
});

const SHAPES = new Set(COUNTRY_PATHS.map(([iso2]) => iso2));

type RouteMapProps = {
  /** ISO alpha-2 of the origin country, or null when the case has none on file. */
  originIso2: string | null;
  originName: string | null;
};

/**
 * Small route map for one shipment card: the world cropped to the origin
 * country and Ethiopia, the origin filled in brand blue, a dashed route to the
 * destination and a marker at each end. Needs <ShipmentMapDefs /> on the page.
 */
export const ShipmentRouteMap = memo(function ShipmentRouteMap({
  originIso2,
  originName,
}: RouteMapProps) {
  const dest = getCountryMeta(DESTINATION_ISO2);
  const origin = originIso2 ? getCountryMeta(originIso2) : null;
  if (!dest) return null;

  const isDomestic = origin?.iso2 === DESTINATION_ISO2;
  const from = origin && !isDomestic ? { x: origin.x, y: origin.y } : null;
  const to = { x: dest.x, y: dest.y };
  const vb = routeViewBox(from, to);
  const arc = from ? routeArc(from, to) : null;

  const unit = vb.w / 330; // about one CSS pixel on a 330px wide card
  const markerR = 4.2 * unit;
  const label = origin
    ? isDomestic
      ? `Map: shipment within ${dest.name}`
      : `Map: route from ${originName ?? origin.name} to ${dest.name}`
    : `Map of ${dest.name}, the destination. The origin country is not on file.`;

  return (
    <div className="relative aspect-[12/5] w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
      <svg
        viewBox={formatViewBox(vb)}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={label}
        className="absolute inset-0 h-full w-full"
      >
        <use
          href={`#${WORLD_ID}`}
          fill={LAND}
          stroke="#ffffff"
          strokeWidth={0.7 * unit}
          strokeLinejoin="round"
        />
        {origin && !isDomestic && SHAPES.has(origin.iso2) ? (
          <use
            href={`#${countryId(origin.iso2)}`}
            fill={BRAND}
            fillOpacity={0.85}
            stroke="#ffffff"
            strokeWidth={0.7 * unit}
            strokeLinejoin="round"
          />
        ) : null}
        {SHAPES.has(DESTINATION_ISO2) ? (
          <use
            href={`#${countryId(DESTINATION_ISO2)}`}
            fill={DESTINATION}
            fillOpacity={0.9}
            stroke="#ffffff"
            strokeWidth={0.7 * unit}
            strokeLinejoin="round"
          />
        ) : null}
        {arc ? (
          <path
            d={arc.d}
            fill="none"
            stroke={MARKER}
            strokeOpacity={0.75}
            strokeWidth={1.6 * unit}
            strokeLinecap="round"
            strokeDasharray={`${5 * unit} ${4 * unit}`}
          />
        ) : null}
        {from ? (
          <circle
            cx={from.x}
            cy={from.y}
            r={markerR}
            fill={MARKER}
            stroke="#ffffff"
            strokeWidth={1.5 * unit}
          />
        ) : null}
        <circle
          cx={to.x}
          cy={to.y}
          r={markerR}
          fill={DESTINATION}
          stroke="#ffffff"
          strokeWidth={1.5 * unit}
        />
      </svg>

      {!origin ? (
        <span className="absolute left-2 top-2 rounded-lg border border-slate-200 bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-500">
          Origin country not on file
        </span>
      ) : null}
    </div>
  );
});