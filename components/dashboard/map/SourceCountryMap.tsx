import mapData from "@/components/dashboard/map/world-paths.json";
import {
  BentoCard,
  BentoCardHeader,
  PeriodPill,
} from "@/components/dashboard/bento/BentoCard";
import { BENTO_COLORS } from "@/components/dashboard/bento/charts";
import { BentoIcon } from "@/components/dashboard/bento/icons";
import { getCountryMeta, DESTINATION_ISO2 } from "@/lib/country-codes";
import {
  STEP_OPACITY,
  arcPath,
  formatShare,
  intensityStep,
  markerSize,
  type SourceCountry,
  type SourceCountrySummary,
} from "@/lib/dashboard-map-utils";

type WorldMapData = { width: number; height: number; paths: { c: string; d: string }[] };
const WORLD = mapData as WorldMapData;

const NEUTRAL_FILL = "#e6ebf2";
const BRAND = BENTO_COLORS.brand;
const DESTINATION = BENTO_COLORS.indigo;
/** Deeper shade of the brand blue so markers stand out on filled countries. */
const MARKER = "#0057b8";

function plural(n: number): string {
  return n === 1 ? "case" : "cases";
}

function tooltipPosition(xPct: number, yPct: number): string {
  const h =
    xPct < 18 ? "left-0" : xPct > 82 ? "right-0" : "left-1/2 -translate-x-1/2";
  const v = yPct < 30 ? "top-full mt-2.5" : "bottom-full mb-2.5";
  return `${h} ${v}`;
}

/**
 * "Cases by source country": a static inline-SVG world map (no runtime fetch,
 * no client JS). Source countries are filled in steps of the brand blue and
 * carry a sized marker plus a flow line to Ethiopia, the destination of every
 * import case. Markers are real focusable buttons with CSS hover/focus
 * tooltips; a table below gives the same data to assistive tech.
 */
export function SourceCountryMap({
  summary,
  periodLabel = "All time",
}: {
  summary: SourceCountrySummary;
  periodLabel?: string;
}) {
  const { countries, total, unknownCount, max } = summary;
  const { width: W, height: H } = WORLD;
  const hasData = countries.length > 0;
  const dest = getCountryMeta(DESTINATION_ISO2);
  const byIso = new Map(countries.map((c) => [c.iso2, c]));
  const top5 = countries.slice(0, 5);
  const sources = countries.filter((c) => c.iso2 !== DESTINATION_ISO2);

  const summaryLabel = hasData
    ? `World map of ${total.toLocaleString()} import ${plural(total)} by source country, all flowing to Ethiopia. Top sources: ${top5
        .map((c) => `${c.name} ${c.count} ${plural(c.count)}`)
        .join(", ")}.`
    : "World map of import cases by source country. No cases have a source country yet.";

  const neutral = WORLD.paths.filter(
    (p) => !byIso.has(p.c) && p.c !== DESTINATION_ISO2,
  );
  const highlighted = WORLD.paths.filter(
    (p) => byIso.has(p.c) && p.c !== DESTINATION_ISO2,
  );
  const destinationShapes = WORLD.paths.filter((p) => p.c === DESTINATION_ISO2);

  return (
    <BentoCard label="Cases by source country" className="flex flex-col">
      <BentoCardHeader
        title="Cases by source country"
        action={<PeriodPill>{periodLabel}</PeriodPill>}
      />

      <div
        className="relative w-full"
        style={{ aspectRatio: `${W} / ${H}`, containerType: "inline-size" }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={summaryLabel}
          className="absolute inset-0 h-full w-full"
        >
          <title>{summaryLabel}</title>
          <g fill={NEUTRAL_FILL} stroke="#ffffff" strokeWidth={0.6} strokeLinejoin="round">
            {neutral.map((p, i) => (
              <path key={`${p.c}-${i}`} d={p.d} />
            ))}
          </g>
          <g stroke="#ffffff" strokeWidth={0.6} strokeLinejoin="round">
            {highlighted.map((p, i) => {
              const c = byIso.get(p.c);
              if (!c) return null;
              const step = intensityStep(c.count, max);
              return (
                <path
                  key={`${p.c}-${i}`}
                  d={p.d}
                  fill={BRAND}
                  fillOpacity={STEP_OPACITY[step - 1]}
                >
                  <title>{`${c.name}: ${c.count} ${plural(c.count)}`}</title>
                </path>
              );
            })}
          </g>
          <g fill={DESTINATION} fillOpacity={0.9} stroke="#ffffff" strokeWidth={0.6}>
            {destinationShapes.map((p, i) => (
              <path key={`${p.c}-${i}`} d={p.d}>
                <title>Ethiopia (destination)</title>
              </path>
            ))}
          </g>

          {dest ? (
            <g className="max-sm:hidden" fill="none" strokeLinecap="round">
              {sources.map((c) => {
                const d = arcPath(c.x, c.y, dest.x, dest.y);
                if (!d) return null;
                const w = 1 + 1.6 * Math.sqrt(c.count / max);
                return (
                  <path
                    key={c.iso2}
                    d={d}
                    stroke={BRAND}
                    strokeOpacity={0.55}
                    strokeWidth={w.toFixed(2)}
                    strokeDasharray="5 4"
                  />
                );
              })}
            </g>
          ) : null}
        </svg>

        {hasData
          ? sources.map((c) => (
              <CountryMarker key={c.iso2} country={c} max={max} W={W} H={H} />
            ))
          : null}

        {dest ? (
          <div
            className="pointer-events-none absolute"
            style={{
              left: `${(dest.x / W) * 100}%`,
              top: `${(dest.y / H) * 100}%`,
            }}
          >
            <span
              aria-hidden="true"
              className="absolute -top-3 -left-3 h-6 w-6 rounded-full motion-safe:animate-ping"
              style={{ backgroundColor: DESTINATION, opacity: 0.35 }}
            />
            <span
              aria-hidden="true"
              className="absolute -top-[7px] -left-[7px] h-3.5 w-3.5 rounded-full border-2 border-white"
              style={{ backgroundColor: DESTINATION }}
            />
            <span className="absolute top-1/2 right-4 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-indigo-600 px-2.5 py-1 text-left text-white sm:block">
              <span className="block text-[9px] font-semibold uppercase tracking-wider text-indigo-200">
                Destination
              </span>
              <span className="block text-xs font-bold leading-tight">Ethiopia</span>
            </span>
          </div>
        ) : null}

        {!hasData ? (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="max-w-xs rounded-2xl border border-slate-200/70 bg-white/90 px-5 py-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#007bff]">
                <BentoIcon name="cases" className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-slate-900">No source countries yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Set the country of export on an import case and it will appear here.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {hasData ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Fewer</span>
              <span className="flex overflow-hidden rounded-full" aria-hidden="true">
                {STEP_OPACITY.map((o) => (
                  <span
                    key={o}
                    className="h-2 w-6"
                    style={{ backgroundColor: BRAND, opacity: o }}
                  />
                ))}
              </span>
              <span className="font-semibold">More cases</span>
            </div>
            <p>
              {total.toLocaleString()} {plural(total)} with a source country
              {unknownCount > 0
                ? ` \u00b7 ${unknownCount.toLocaleString()} without one on file`
                : ""}
            </p>
          </div>

          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {top5.map((c, i) => (
              <li key={c.iso2} className="min-w-0 rounded-xl bg-slate-50/80 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: BRAND,
                      opacity: STEP_OPACITY[intensityStep(c.count, max) - 1],
                    }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-xs font-semibold text-slate-700">
                    {i + 1}. {c.name}
                  </span>
                </div>
                <p className="mt-1 text-lg font-bold leading-none tabular-nums text-slate-900">
                  {c.count.toLocaleString()}
                  <span className="ml-1.5 text-[11px] font-medium text-slate-400">
                    {formatShare(c.share)}
                  </span>
                </p>
              </li>
            ))}
          </ol>

          <table className="sr-only">
            <caption>Import cases by source country</caption>
            <thead>
              <tr>
                <th scope="col">Country</th>
                <th scope="col">Cases</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {countries.map((c) => (
                <tr key={c.iso2}>
                  <th scope="row">{c.name}</th>
                  <td>{c.count}</td>
                  <td>{formatShare(c.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </BentoCard>
  );
}

function CountryMarker({
  country,
  max,
  W,
  H,
}: {
  country: SourceCountry;
  max: number;
  W: number;
  H: number;
}) {
  const xPct = (country.x / W) * 100;
  const yPct = (country.y / H) * 100;
  const size = markerSize(country.count, max);
  const dim = `clamp(9px, ${((size / 700) * 100).toFixed(2)}cqw, ${size}px)`;
  const label = `${country.name}: ${country.count} ${plural(country.count)}, ${formatShare(country.share)} of cases`;

  return (
    <button
      type="button"
      aria-label={label}
      className="group/marker absolute z-10 rounded-full focus-visible:z-30 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#007bff] hover:z-30"
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        // Scales with the map width (about 700px = full size) so markers stay small on phones.
        width: dim,
        height: dim,
        transform: "translate(-50%, -50%)",
      }}
    >
      <span
        aria-hidden="true"
        className="absolute -inset-1 rounded-full"
        style={{ backgroundColor: MARKER, opacity: 0.2 }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full border-2 border-white"
        style={{ backgroundColor: MARKER }}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute w-max max-w-[11rem] rounded-xl bg-slate-900 px-3 py-2 text-left text-white opacity-0 transition-opacity group-hover/marker:opacity-100 group-focus-visible/marker:opacity-100 ${tooltipPosition(xPct, yPct)}`}
      >
        <span className="block truncate text-xs font-bold">{country.name}</span>
        <span className="block text-[11px] text-slate-300">
          {country.count.toLocaleString()} {plural(country.count)} &middot;{" "}
          {formatShare(country.share)}
        </span>
      </span>
    </button>
  );
}