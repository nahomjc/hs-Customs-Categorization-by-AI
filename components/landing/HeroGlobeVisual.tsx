"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useReducedMotion } from "framer-motion";
import landDotsRaw from "@/lib/land-dots.json";
import ethiopiaDotsRaw from "@/lib/ethiopia-dots.json";
import ethiopiaRings from "@/lib/ethiopia-rings.json";

type LandDot = {
  lat: number;
  lon: number;
  cosLat: number;
  sinLat: number;
  inland: number;
  region: number;
  /** Ethiopian flag band: 0 none, 1 green, 2 yellow, 3 red */
  flag: 0 | 1 | 2 | 3;
};

type RegionDef = {
  id: string;
  /** Soft brand-safe regional tint */
  rgb: readonly [number, number, number];
  /** Approx center lon (rad) — used to sync glow with facing side */
  centerLon: number;
  test: (lonDeg: number, latDeg: number) => boolean;
};

/** Face Horn of Africa so Ethiopia is visible on first paint */
const INITIAL_ROT_Y = -0.68;
const INITIAL_ROT_X = 0.08;
/** Soft entrance spin — eases into the resting view */
const INTRO_ROT_Y = INITIAL_ROT_Y - 0.72;
const INTRO_ROT_X = INITIAL_ROT_X + 0.1;
const INTRO_MS = 1600;

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

/** Ethiopian flag colors */
const FLAG_GREEN = [7, 137, 48] as const;
const FLAG_YELLOW = [252, 221, 9] as const;
const FLAG_RED = [218, 18, 26] as const;

type LonLat = [number, number];

function pointInRing(lon: number, lat: number, ring: LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Accurate Natural Earth Ethiopia boundary */
function isEthiopia(lonDeg: number, latDeg: number): boolean {
  const polys = ethiopiaRings as LonLat[][][];
  for (const rings of polys) {
    if (!pointInRing(lonDeg, latDeg, rings[0])) continue;
    let inHole = false;
    for (let h = 1; h < rings.length; h++) {
      if (pointInRing(lonDeg, latDeg, rings[h])) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

function flagRgb(band: 1 | 2 | 3): readonly [number, number, number] {
  if (band === 1) return FLAG_GREEN;
  if (band === 2) return FLAG_YELLOW;
  return FLAG_RED;
}

/** Trade regions — distinct colors, professional palette (specific → broad) */
const REGIONS: RegionDef[] = [
  {
    id: "north-america",
    rgb: [37, 99, 235],
    centerLon: (-100 * Math.PI) / 180,
    test: (lon, lat) => lon >= -170 && lon <= -50 && lat >= 15 && lat <= 83,
  },
  {
    id: "south-america",
    rgb: [16, 185, 129],
    centerLon: (-60 * Math.PI) / 180,
    test: (lon, lat) => lon >= -82 && lon <= -34 && lat >= -56 && lat < 15,
  },
  {
    id: "europe",
    rgb: [99, 102, 241],
    centerLon: (10 * Math.PI) / 180,
    test: (lon, lat) => lon >= -12 && lon <= 40 && lat >= 36 && lat <= 72,
  },
  {
    id: "middle-east",
    rgb: [236, 72, 153],
    centerLon: (45 * Math.PI) / 180,
    test: (lon, lat) => lon >= 32 && lon <= 62 && lat >= 12 && lat <= 42,
  },
  {
    id: "south-asia",
    rgb: [14, 165, 233],
    centerLon: (78 * Math.PI) / 180,
    test: (lon, lat) => lon >= 60 && lon <= 95 && lat >= 5 && lat <= 36,
  },
  {
    id: "east-asia",
    rgb: [6, 182, 212],
    centerLon: (115 * Math.PI) / 180,
    test: (lon, lat) => lon >= 95 && lon <= 150 && lat >= 18 && lat <= 55,
  },
  {
    id: "se-asia",
    rgb: [34, 197, 94],
    centerLon: (115 * Math.PI) / 180,
    test: (lon, lat) => lon >= 95 && lon <= 140 && lat >= -11 && lat < 18,
  },
  {
    id: "oceania",
    rgb: [168, 85, 247],
    centerLon: (134 * Math.PI) / 180,
    test: (lon, lat) => lon >= 110 && lon <= 180 && lat >= -48 && lat <= -10,
  },
  {
    id: "africa",
    rgb: [245, 158, 11],
    centerLon: (20 * Math.PI) / 180,
    test: (lon, lat) => lon >= -18 && lon <= 52 && lat >= -35 && lat < 38,
  },
];

const REGION_CYCLE_MS = 3200;

/** Addis Ababa — hub for outbound routes */
const ETH_HUB_LAT = (9.03 * Math.PI) / 180;
const ETH_HUB_LON = (38.75 * Math.PI) / 180;
/** Djibouti / Red Sea gate for Ethiopia trade ships */
const ETH_PORT_LAT = (11.6 * Math.PI) / 180;
const ETH_PORT_LON = (43.15 * Math.PI) / 180;

function regionIndexFor(lonDeg: number, latDeg: number): number {
  for (let i = 0; i < REGIONS.length; i++) {
    if (REGIONS[i].test(lonDeg, latDeg)) return i;
  }
  return -1; // unassigned land — neutral gray
}

function shortestLonDelta(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function lerpLon(a: number, b: number, t: number) {
  return a + shortestLonDelta(b, a) * t;
}

type RouteVehicle = {
  id: string;
  type: "plane" | "ship";
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  /** Progress units per ms (full loop = 1) */
  speed: number;
  phase: number;
  altitude: number;
  scale: number;
  /** Trail hue in degrees — planes get a colorful light wake */
  trailHue: number;
};

/** Planes & ships flowing in/out of Ethiopia */
const VEHICLES: RouteVehicle[] = [
  // Planes — Addis ↔ hubs (speed = one-way progress per ms)
  {
    id: "plane-eu",
    type: "plane",
    fromLat: ETH_HUB_LAT,
    fromLon: ETH_HUB_LON,
    toLat: (51.5 * Math.PI) / 180,
    toLon: (-0.1 * Math.PI) / 180,
    speed: 0.00028,
    phase: 0,
    altitude: 1.14,
    scale: 1.12,
    trailHue: 210,
  },
  {
    id: "plane-me",
    type: "plane",
    fromLat: ETH_HUB_LAT,
    fromLon: ETH_HUB_LON,
    toLat: (25.2 * Math.PI) / 180,
    toLon: (55.3 * Math.PI) / 180,
    speed: 0.00034,
    phase: 0.35,
    altitude: 1.13,
    scale: 1.05,
    trailHue: 320,
  },
  {
    id: "plane-asia",
    type: "plane",
    fromLat: ETH_HUB_LAT,
    fromLon: ETH_HUB_LON,
    toLat: (31.2 * Math.PI) / 180,
    toLon: (121.5 * Math.PI) / 180,
    speed: 0.00022,
    phase: 0.7,
    altitude: 1.15,
    scale: 1,
    trailHue: 175,
  },
  {
    id: "plane-us",
    type: "plane",
    fromLat: ETH_HUB_LAT,
    fromLon: ETH_HUB_LON,
    toLat: (40.7 * Math.PI) / 180,
    toLon: (-74 * Math.PI) / 180,
    speed: 0.0002,
    phase: 1.15,
    altitude: 1.16,
    scale: 1.08,
    trailHue: 45,
  },
  {
    id: "plane-sa",
    type: "plane",
    fromLat: ETH_HUB_LAT,
    fromLon: ETH_HUB_LON,
    toLat: (-26.2 * Math.PI) / 180,
    toLon: (28.0 * Math.PI) / 180, // Johannesburg
    speed: 0.00026,
    phase: 1.55,
    altitude: 1.13,
    scale: 0.98,
    trailHue: 280,
  },
  // Ships — Djibouti ↔ ports
  {
    id: "ship-suez",
    type: "ship",
    fromLat: ETH_PORT_LAT,
    fromLon: ETH_PORT_LON,
    toLat: (31.2 * Math.PI) / 180,
    toLon: (32.3 * Math.PI) / 180,
    speed: 0.00007,
    phase: 0.2,
    altitude: 1.02,
    scale: 1.02,
    trailHue: 200,
  },
  {
    id: "ship-india",
    type: "ship",
    fromLat: ETH_PORT_LAT,
    fromLon: ETH_PORT_LON,
    toLat: (18.9 * Math.PI) / 180,
    toLon: (72.8 * Math.PI) / 180,
    speed: 0.000055,
    phase: 0.9,
    altitude: 1.02,
    scale: 0.95,
    trailHue: 200,
  },
  {
    id: "ship-cape",
    type: "ship",
    fromLat: ETH_PORT_LAT,
    fromLon: ETH_PORT_LON,
    toLat: (-33.9 * Math.PI) / 180,
    toLon: (18.4 * Math.PI) / 180,
    speed: 0.00005,
    phase: 1.4,
    altitude: 1.015,
    scale: 0.92,
    trailHue: 200,
  },
];

/** Reused trail point buffer — avoid allocs in the vehicle loop */
const TRAIL_PTS: { x: number; y: number; z: number }[] = Array.from(
  { length: 28 },
  () => ({ x: 0, y: 0, z: 0 }),
);

type VehicleMotion = {
  angle: number;
  alpha: number;
  initialized: boolean;
};

function lerpAngle(from: number, to: number, t: number) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

/** Soft ease for plane route progress — slows at hubs, glides in the middle */
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function smoothToward(
  current: number,
  target: number,
  dt: number,
  rate: number,
) {
  const k = 1 - Math.exp(-rate * dt);
  return current + (target - current) * k;
}

/** World land dots, with Ethiopia cut out then replaced by dense accurate flag dots */
const LAND_DOTS: LandDot[] = (() => {
  const world: LandDot[] = (landDotsRaw as [number, number, number, number][])
    .map(([lat, lon, , inland]) => {
      const lonDeg = (lon * 180) / Math.PI;
      const latDeg = (lat * 180) / Math.PI;
      return {
        lat,
        lon,
        cosLat: Math.cos(lat),
        sinLat: Math.sin(lat),
        inland,
        region: regionIndexFor(lonDeg, latDeg),
        flag: 0 as const,
      };
    })
    .filter(
      (d) => !isEthiopia((d.lon * 180) / Math.PI, (d.lat * 180) / Math.PI),
    );

  const ethiopia: LandDot[] = (
    ethiopiaDotsRaw as [number, number, number, number][]
  ).map(([lat, lon, inland, flag]) => ({
    lat,
    lon,
    cosLat: Math.cos(lat),
    sinLat: Math.sin(lat),
    inland,
    region: -1,
    flag: flag as 1 | 2 | 3,
  }));

  return world.concat(ethiopia);
})();

/** Region glow lookup — filled each frame, avoids closures in the hot loop */
const REGION_GLOW = new Float32Array(REGIONS.length);

function project(
  lat: number,
  lon: number,
  rotY: number,
  rotX: number,
  radius: number,
) {
  const x0 = radius * Math.cos(lat) * Math.sin(lon);
  const y0 = radius * Math.sin(lat);
  const z0 = radius * Math.cos(lat) * Math.cos(lon);

  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = x0 * cosY + z0 * sinY;
  const z1 = -x0 * sinY + z0 * cosY;

  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y2 = y0 * cosX - z1 * sinX;
  const z2 = y0 * sinX + z1 * cosX;

  return { x: x1, y: y2, z: z2 };
}

/** Same math as project(), writes into `out` to avoid per-dot allocations */
function projectInto(
  cosLat: number,
  sinLat: number,
  lon: number,
  cosY: number,
  sinY: number,
  cosX: number,
  sinX: number,
  radius: number,
  out: { x: number; y: number; z: number },
) {
  const x0 = radius * cosLat * Math.sin(lon);
  const y0 = radius * sinLat;
  const z0 = radius * cosLat * Math.cos(lon);
  const x1 = x0 * cosY + z0 * sinY;
  const z1 = -x0 * sinY + z0 * cosY;
  out.x = x1;
  out.y = y0 * cosX - z1 * sinX;
  out.z = y0 * sinX + z1 * cosX;
}

/**
 * Minimal map icons — single-tone silhouettes that stay crisp at small sizes.
 * Nose / bow points +X (travel direction).
 */
function drawPlane(
  ctx: CanvasRenderingContext2D,
  scale: number,
  alpha: number,
) {
  const s = 11 * scale;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Soft contact shadow
  ctx.fillStyle = "rgba(15,23,42,0.14)";
  ctx.beginPath();
  ctx.ellipse(0, s * 0.08, s * 0.55, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Classic top-down jet silhouette (one path)
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  // nose
  ctx.moveTo(s * 0.72, 0);
  ctx.quadraticCurveTo(s * 0.72, -s * 0.08, s * 0.45, -s * 0.09);
  // right wing root → tip
  ctx.lineTo(s * 0.12, -s * 0.1);
  ctx.lineTo(-s * 0.05, -s * 0.55);
  ctx.lineTo(-s * 0.22, -s * 0.55);
  ctx.lineTo(-s * 0.08, -s * 0.12);
  // tail right
  ctx.lineTo(-s * 0.42, -s * 0.1);
  ctx.lineTo(-s * 0.62, -s * 0.28);
  ctx.lineTo(-s * 0.55, -s * 0.04);
  // center rear
  ctx.lineTo(-s * 0.55, s * 0.04);
  // tail left
  ctx.lineTo(-s * 0.62, s * 0.28);
  ctx.lineTo(-s * 0.42, s * 0.1);
  // left wing
  ctx.lineTo(-s * 0.08, s * 0.12);
  ctx.lineTo(-s * 0.22, s * 0.55);
  ctx.lineTo(-s * 0.05, s * 0.55);
  ctx.lineTo(s * 0.12, s * 0.1);
  ctx.lineTo(s * 0.45, s * 0.09);
  ctx.quadraticCurveTo(s * 0.72, s * 0.08, s * 0.72, 0);
  ctx.closePath();
  ctx.fill();

  // Brand accent stripe on fuselage
  ctx.strokeStyle = "#007bff";
  ctx.lineWidth = Math.max(1.1, s * 0.09);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, 0);
  ctx.lineTo(s * 0.42, 0);
  ctx.stroke();

  ctx.restore();
}

function drawShip(ctx: CanvasRenderingContext2D, scale: number, alpha: number) {
  const s = 12 * scale;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Soft contact shadow
  ctx.fillStyle = "rgba(15,23,42,0.14)";
  ctx.beginPath();
  ctx.ellipse(0, s * 0.3, s * 0.55, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hull + bow as one silhouette
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.moveTo(-s * 0.58, s * 0.04);
  ctx.lineTo(s * 0.32, s * 0.04);
  ctx.lineTo(s * 0.62, -s * 0.02);
  ctx.lineTo(s * 0.42, s * 0.32);
  ctx.lineTo(-s * 0.35, s * 0.32);
  ctx.lineTo(-s * 0.58, s * 0.16);
  ctx.closePath();
  ctx.fill();

  // Deck / containers block
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.moveTo(-s * 0.48, s * 0.04);
  ctx.lineTo(s * 0.18, s * 0.04);
  ctx.lineTo(s * 0.18, -s * 0.14);
  ctx.lineTo(-s * 0.48, -s * 0.14);
  ctx.closePath();
  ctx.fill();

  // Bridge
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(s * 0.2, -s * 0.28, s * 0.2, s * 0.32);

  // Chimney / funnel
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(s * 0.08, -s * 0.42, s * 0.1, s * 0.3);
  ctx.fillStyle = "#007bff";
  ctx.fillRect(s * 0.08, -s * 0.42, s * 0.1, s * 0.06);

  // Brand waterline
  ctx.strokeStyle = "#007bff";
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-s * 0.48, s * 0.14);
  ctx.lineTo(s * 0.36, s * 0.14);
  ctx.stroke();

  // Tiny bridge window
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(s * 0.24, -s * 0.22, s * 0.12, s * 0.06);

  ctx.restore();
}

/** Soft chimney smoke — rises from the funnel and drifts aft */
function drawShipSmoke(
  ctx: CanvasRenderingContext2D,
  scale: number,
  alpha: number,
  time: number,
  phase: number,
) {
  const s = 12 * scale;
  const chimneyX = s * 0.13;
  const chimneyY = -s * 0.44;
  const puffCount = 7;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  for (let i = 0; i < puffCount; i++) {
    const cycle = (time * 0.00055 + phase * 0.37 + i * 0.14) % 1;
    const rise = cycle;
    // Drift aft (toward -X, opposite bow) and slightly sway
    const sway =
      Math.sin(time * 0.003 + phase * 4 + i * 1.7) * s * 0.08 * rise;
    const x = chimneyX - rise * s * 0.55 + sway;
    const y = chimneyY - rise * s * 0.95 - Math.sin(rise * Math.PI) * s * 0.06;
    const r = s * (0.1 + rise * 0.38);
    const a = alpha * (1 - rise) * (1 - rise) * 0.42;

    if (a < 0.02) continue;

    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(148,163,184,${a * 0.85})`);
    g.addColorStop(0.45, `rgba(100,116,139,${a * 0.45})`);
    g.addColorStop(1, `rgba(71,85,105,0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function HeroGlobeVisual({ reduced }: { reduced?: boolean }) {
  const prefersReduced = useReducedMotion() ?? false;
  const noMotion = reduced || prefersReduced;

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotY = useRef(noMotion ? INITIAL_ROT_Y : INTRO_ROT_Y);
  const rotX = useRef(noMotion ? INITIAL_ROT_X : INTRO_ROT_X);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const velocity = useRef({ y: 0, x: 0 });
  const timeRef = useRef(0);
  const vehicleMotion = useRef<Record<string, VehicleMotion>>({});
  const introStartRef = useRef<number | null>(null);

  const light = useMemo(() => {
    const lx = -0.4;
    const ly = 0.55;
    const lz = 0.75;
    const len = Math.hypot(lx, ly, lz);
    return { x: lx / len, y: ly / len, z: lz / len };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx =
      canvas.getContext("2d", { alpha: true, desynchronized: true }) ??
      canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let dpr = 1;
    let vehicleBoost = 1;
    let inView = true;
    let pageVisible = document.visibilityState === "visible";
    let introLoading =
      document.documentElement.dataset.introLoading === "true";
    let scrolling = false;
    let scrollIdleTimer = 0;
    const visibleBuf: {
      p: LandDot;
      x: number;
      y: number;
      z: number;
      glow: number;
    }[] = [];
    let visibleCount = 0;
    const proj = { x: 0, y: 0, z: 0 };

    // Cache gradients — recreating every frame was a big source of jank
    let bloomGrad: CanvasGradient | null = null;
    let oceanGrad: CanvasGradient | null = null;
    let fadeGrad: CanvasGradient | null = null;
    let rimGrad: CanvasGradient | null = null;
    let cachedRadius = 0;
    let cachedCx = 0;
    let cachedCy = 0;

    const rebuildGradients = (cx: number, cy: number, radius: number) => {
      cachedRadius = radius;
      cachedCx = cx;
      cachedCy = cy;

      bloomGrad = ctx.createRadialGradient(
        cx - radius * 0.25,
        cy - radius * 0.3,
        radius * 0.1,
        cx,
        cy,
        radius * 1.15,
      );
      bloomGrad.addColorStop(0, "rgba(0,123,255,0.16)");
      bloomGrad.addColorStop(0.45, "rgba(0,123,255,0.04)");
      bloomGrad.addColorStop(1, "rgba(0,123,255,0)");

      oceanGrad = ctx.createRadialGradient(
        cx - radius * 0.35,
        cy - radius * 0.4,
        radius * 0.05,
        cx,
        cy,
        radius,
      );
      oceanGrad.addColorStop(0, "rgba(241,245,249,0.95)");
      oceanGrad.addColorStop(0.55, "rgba(226,232,240,0.72)");
      oceanGrad.addColorStop(1, "rgba(203,213,225,0.55)");

      fadeGrad = ctx.createRadialGradient(
        cx,
        cy,
        radius * 0.72,
        cx,
        cy,
        radius * 1.02,
      );
      fadeGrad.addColorStop(0, "rgba(248,249,250,0)");
      fadeGrad.addColorStop(0.7, "rgba(248,249,250,0)");
      fadeGrad.addColorStop(1, "rgba(248,249,250,0.55)");

      rimGrad = ctx.createRadialGradient(
        cx - radius * 0.4,
        cy - radius * 0.45,
        0,
        cx - radius * 0.2,
        cy - radius * 0.25,
        radius * 0.7,
      );
      rimGrad.addColorStop(0, "rgba(255,255,255,0.28)");
      rimGrad.addColorStop(0.35, "rgba(255,255,255,0.08)");
      rimGrad.addColorStop(1, "rgba(255,255,255,0)");
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(1.75, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      bloomGrad = null;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting && entry.intersectionRatio > 0.05;
      },
      { threshold: [0, 0.05, 0.2] },
    );
    io.observe(wrap);

    const onVis = () => {
      pageVisible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVis);

    const syncIntroLoading = () => {
      introLoading =
        document.documentElement.dataset.introLoading === "true";
    };
    const introMo = new MutationObserver(syncIntroLoading);
    introMo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-intro-loading"],
    });

    const onScroll = () => {
      scrolling = true;
      window.clearTimeout(scrollIdleTimer);
      // Resume globe shortly after scroll settles
      scrollIdleTimer = window.setTimeout(() => {
        scrolling = false;
      }, 140);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // Freeze while intro loader / scroll / off-screen so the page stays smooth
      if (
        introLoading ||
        !inView ||
        !pageVisible ||
        (scrolling && !dragging.current)
      ) {
        last = now;
        return;
      }

      const dt = Math.min(32, now - last);
      last = now;
      if (!noMotion) timeRef.current += dt;

      // Opening transition: ease rotation from intro angle → resting view
      // Starts only after the intro loader clears (see introLoading gate above)
      let introAlpha = 1;
      if (!noMotion) {
        if (introStartRef.current === null) introStartRef.current = now;
        const introT = Math.min(
          1,
          (now - introStartRef.current) / INTRO_MS,
        );
        const e = easeOutExpo(introT);
        introAlpha = 0.2 + 0.8 * e;

        if (introT < 1 && !dragging.current) {
          rotY.current = INTRO_ROT_Y + (INITIAL_ROT_Y - INTRO_ROT_Y) * e;
          rotX.current = INTRO_ROT_X + (INITIAL_ROT_X - INTRO_ROT_X) * e;
          // Gentle settle — no free spin until intro finishes
          velocity.current.y *= 0.85;
          velocity.current.x *= 0.85;
        } else if (!dragging.current) {
          rotY.current += dt * 0.00011 + velocity.current.y;
          rotX.current += velocity.current.x;
          velocity.current.y *= 0.92;
          velocity.current.x *= 0.9;
          rotX.current = Math.max(-0.55, Math.min(0.55, rotX.current));
        } else {
          velocity.current.y *= 0.88;
          velocity.current.x *= 0.88;
        }
      } else if (!dragging.current) {
        velocity.current.y *= 0.88;
        velocity.current.x *= 0.88;
      }

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.42;

      if (
        !bloomGrad ||
        !oceanGrad ||
        !fadeGrad ||
        !rimGrad ||
        Math.abs(radius - cachedRadius) > 0.5 ||
        Math.abs(cx - cachedCx) > 0.5 ||
        Math.abs(cy - cachedCy) > 0.5
      ) {
        rebuildGradients(cx, cy, radius);
      }

      const bloom = bloomGrad;
      const ocean = oceanGrad;
      const fade = fadeGrad;
      const rim = rimGrad;
      if (!bloom || !ocean || !fade || !rim) return;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = introAlpha;

      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = ocean;
      ctx.fill();
      ctx.strokeStyle = "rgba(148,163,184,0.28)";
      ctx.lineWidth = 1.25 * dpr;
      ctx.stroke();

      ctx.strokeStyle = "rgba(148,163,184,0.11)";
      ctx.lineWidth = 1 * dpr;
      for (const band of [-0.55, 0, 0.55]) {
        ctx.beginPath();
        ctx.ellipse(
          cx,
          cy + band * radius * 0.72,
          radius * Math.cos(band * 0.95) * 0.98,
          radius * 0.28,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }

      ctx.setLineDash([4 * dpr, 6 * dpr]);
      ctx.strokeStyle = "rgba(0,123,255,0.12)";
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy + radius * 0.02,
        radius * 0.98,
        radius * 0.24,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.setLineDash([]);

      // Land dots — regional colors + soft pulse glow cycling nations
      const rotYNow = rotY.current;
      const rotXNow = rotX.current;
      const cosY = Math.cos(rotYNow);
      const sinY = Math.sin(rotYNow);
      const cosX = Math.cos(rotXNow);
      const sinX = Math.sin(rotXNow);
      const lx = light.x;
      const ly = light.y;
      const lz = light.z;
      const t = timeRef.current;
      const frontLon = -rotYNow;

      const cyclePos = noMotion ? 0 : t / REGION_CYCLE_MS;
      const activeIdx = Math.floor(cyclePos) % REGIONS.length;
      const nextIdx = (activeIdx + 1) % REGIONS.length;
      const phase = cyclePos - Math.floor(cyclePos);
      const breath = Math.sin(phase * Math.PI);
      const handoff = phase > 0.78 ? (phase - 0.78) / 0.22 : 0;

      for (let ri = 0; ri < REGIONS.length; ri++) {
        if (noMotion) {
          REGION_GLOW[ri] = 0;
          continue;
        }
        let g = 0;
        if (ri === activeIdx) g = breath * (1 - handoff * 0.85);
        if (ri === nextIdx) g = Math.max(g, handoff * breath);
        const d = Math.abs(shortestLonDelta(REGIONS[ri].centerLon, frontLon));
        const face = Math.max(0, 1 - d / 1.1);
        g = Math.max(g * 0.75, g * 0.45 + face * 0.55 * 0.35);
        REGION_GLOW[ri] = Math.min(1, g);
      }

      const ethPulse = noMotion
        ? 0.85
        : 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.0024));
      const ethFace = Math.max(
        0,
        1 - Math.abs(shortestLonDelta((40 * Math.PI) / 180, frontLon)) / 0.95,
      );
      const ethGlow = Math.min(1, ethPulse * (0.65 + ethFace * 0.5));

      visibleCount = 0;
      for (let di = 0; di < LAND_DOTS.length; di++) {
        const p = LAND_DOTS[di];
        projectInto(
          p.cosLat,
          p.sinLat,
          p.lon,
          cosY,
          sinY,
          cosX,
          sinX,
          radius,
          proj,
        );
        if (proj.z <= 0) continue;
        const glow = p.flag
          ? ethGlow
          : p.region >= 0
            ? REGION_GLOW[p.region]
            : 0;
        const slot = visibleBuf[visibleCount];
        if (slot) {
          slot.p = p;
          slot.x = proj.x;
          slot.y = proj.y;
          slot.z = proj.z;
          slot.glow = glow;
        } else {
          visibleBuf[visibleCount] = {
            p,
            x: proj.x,
            y: proj.y,
            z: proj.z,
            glow,
          };
        }
        visibleCount++;
      }

      // Soft glow halos for lit regions + strong Ethiopia flag glow
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < visibleCount; i++) {
        const v = visibleBuf[i];
        const isEth = v.p.flag > 0;
        if (v.glow < 0.08 && !isEth) continue;
        if (!isEth && v.p.region < 0) continue;

        const depth = v.z / radius;
        const [cr, cg, cb] = isEth
          ? flagRgb(v.p.flag as 1 | 2 | 3)
          : REGIONS[v.p.region].rgb;
        const glow = isEth ? Math.max(v.glow, 0.75) : v.glow;
        const gr =
          (isEth ? 2.1 : 1.8) *
          (1 + (1 - v.p.inland) * 0.7) *
          (0.75 + depth * 0.5) *
          dpr *
          (0.7 + glow * 0.95);
        const gaq =
          Math.round((isEth ? 0.16 : 0.1) * glow * (0.5 + depth * 0.5) * 25) /
          25;
        if (gaq < 0.02) continue;
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${gaq})`;
        ctx.beginPath();
        ctx.arc(cx + v.x, cy - v.y, gr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Region-tinted cores — Ethiopia always full flag colors
      for (let i = 0; i < visibleCount; i++) {
        const v = visibleBuf[i];
        const invR = 1 / radius;
        const lit = Math.max(
          0,
          v.x * invR * lx + v.y * invR * ly + v.z * invR * lz,
        );
        const depth = v.z * invR;
        const shade = 0.42 + lit * 0.58;
        const { glow, p } = v;
        const isEth = p.flag > 0;

        const baseR = isEth
          ? 1.05 + (1 - p.inland) * 0.25 + glow * 0.55
          : 0.88 + (1 - p.inland) * 0.28 + glow * 0.55;
        const r = Math.max(0.65 * dpr, baseR * (0.7 + depth * 0.45) * dpr);
        const aq =
          Math.round(
            (isEth
              ? 0.78 + depth * 0.22 + glow * 0.15
              : 0.38 + depth * 0.55 + glow * 0.35) *
              shade *
              20,
          ) / 20;

        if (isEth) {
          const [cr, cg, cb] = flagRgb(p.flag as 1 | 2 | 3);
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(1, aq + 0.15)})`;
        } else if (p.region >= 0) {
          const [cr, cg, cb] = REGIONS[p.region].rgb;
          const mix = 0.35 + glow * 0.65;
          ctx.fillStyle = `rgba(${Math.round(90 + (cr - 90) * mix)},${Math.round(100 + (cg - 100) * mix)},${Math.round(115 + (cb - 115) * mix)},${aq})`;
        } else {
          ctx.fillStyle = `rgba(90,100,115,${aq})`;
        }
        ctx.beginPath();
        ctx.arc(cx + v.x, cy - v.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Vehicles — fast in/out of Ethiopia (ping-pong, no teleport stack)
      for (const v of VEHICLES) {
        // Round trip: 0→1 outbound, 1→2 inbound
        const cycle = noMotion ? v.phase % 2 : (t * v.speed + v.phase) % 2;
        const outbound = cycle < 1;
        const rawU = outbound ? cycle : 2 - cycle;
        // Planes ease at hubs so turnarounds don't snap
        const u = v.type === "plane" ? easeInOutCubic(rawU) : rawU;
        const dir = outbound ? 1 : -1;

        const lat = v.fromLat + (v.toLat - v.fromLat) * u;
        const lon = lerpLon(v.fromLon, v.toLon, u);
        const altLift = v.type === "plane" ? Math.sin(u * Math.PI) * 0.04 : 0;
        const altitude = v.altitude + altLift;

        const pos = project(lat, lon, rotYNow, rotXNow, radius * altitude);
        // Longer look-ahead on planes → steadier heading through curves
        const lookAhead = v.type === "plane" ? 0.07 : 0.04;
        const aheadT = Math.max(0, Math.min(1, u + dir * lookAhead));
        const ahead = project(
          v.fromLat + (v.toLat - v.fromLat) * aheadT,
          lerpLon(v.fromLon, v.toLon, aheadT),
          rotYNow,
          rotXNow,
          radius *
            (v.altitude +
              (v.type === "plane" ? Math.sin(aheadT * Math.PI) * 0.04 : 0)),
        );

        const depth = (pos.z + radius) / (2 * radius);
        const targetAlpha =
          pos.z < -radius * 0.15
            ? 0
            : Math.max(
                0,
                Math.min(1, (pos.z + radius * 0.12) / (radius * 0.55)),
              ) *
              (0.7 + depth * 0.3);

        let motion = vehicleMotion.current[v.id];
        if (!motion) {
          motion = { angle: 0, alpha: 0, initialized: false };
          vehicleMotion.current[v.id] = motion;
        }

        const dx = ahead.x - pos.x;
        const dy = -(ahead.y - pos.y);
        const len = Math.hypot(dx, dy);
        if (len > radius * 0.006) {
          const targetAngle = Math.atan2(dy, dx);
          if (!motion.initialized) {
            motion.angle = targetAngle;
            motion.initialized = true;
          } else {
            // Planes track heading more responsively (less lag / wobble)
            const turnRate = v.type === "plane" ? 0.055 : 0.02;
            motion.angle = lerpAngle(
              motion.angle,
              targetAngle,
              1 - Math.exp(-turnRate * dt),
            );
          }
        }

        const fadeRate = v.type === "plane" ? 0.022 : 0.012;
        motion.alpha = smoothToward(motion.alpha, targetAlpha, dt, fadeRate);
        if (motion.alpha < 0.02) continue;

        // Colorful light line wake for planes
        if (v.type === "plane") {
          const trailSteps = 24;
          const trailSpacing = 0.014;
          let trailCount = 0;
          for (let s = 0; s < trailSteps; s++) {
            const rawTu = Math.max(0, Math.min(1, rawU - dir * s * trailSpacing));
            const tu = easeInOutCubic(rawTu);
            const tLat = v.fromLat + (v.toLat - v.fromLat) * tu;
            const tLon = lerpLon(v.fromLon, v.toLon, tu);
            const tAlt = v.altitude + Math.sin(tu * Math.PI) * 0.04;
            const tp = project(tLat, tLon, rotYNow, rotXNow, radius * tAlt);
            const slot = TRAIL_PTS[trailCount];
            slot.x = tp.x;
            slot.y = tp.y;
            slot.z = tp.z;
            trailCount++;
          }

          if (trailCount >= 2) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            // Soft outer glow ribbon
            ctx.beginPath();
            let started = false;
            for (let s = 0; s < trailCount; s++) {
              const tp = TRAIL_PTS[s];
              if (tp.z <= 0) {
                started = false;
                continue;
              }
              const px = cx + tp.x;
              const py = cy - tp.y;
              if (!started) {
                ctx.moveTo(px, py);
                started = true;
              } else {
                ctx.lineTo(px, py);
              }
            }
            ctx.strokeStyle = `hsla(${v.trailHue}, 95%, 62%, ${motion.alpha * 0.22})`;
            ctx.lineWidth = 7.5 * dpr;
            ctx.stroke();

            // Segmented colorful core — hue shifts along the wake
            for (let s = 0; s < trailCount - 1; s++) {
              const a = TRAIL_PTS[s];
              const b = TRAIL_PTS[s + 1];
              if (a.z <= 0 || b.z <= 0) continue;
              const fade = (1 - s / trailCount) * motion.alpha;
              const hue = (v.trailHue + s * 11) % 360;
              ctx.beginPath();
              ctx.moveTo(cx + a.x, cy - a.y);
              ctx.lineTo(cx + b.x, cy - b.y);
              ctx.strokeStyle = `hsla(${hue}, 100%, 68%, ${fade * 0.85})`;
              ctx.lineWidth = (2.8 - (s / trailCount) * 1.6) * dpr;
              ctx.stroke();
              // Bright hot core near the plane
              if (s < 5) {
                ctx.strokeStyle = `hsla(${hue}, 100%, 88%, ${fade * 0.55})`;
                ctx.lineWidth = (1.15 - s * 0.12) * dpr;
                ctx.stroke();
              }
            }

            // Spark at the tip
            const tip = TRAIL_PTS[0];
            if (tip.z > 0) {
              const g = ctx.createRadialGradient(
                cx + tip.x,
                cy - tip.y,
                0,
                cx + tip.x,
                cy - tip.y,
                6 * dpr,
              );
              g.addColorStop(
                0,
                `hsla(${v.trailHue}, 100%, 92%, ${motion.alpha * 0.9})`,
              );
              g.addColorStop(
                0.45,
                `hsla(${(v.trailHue + 40) % 360}, 100%, 65%, ${motion.alpha * 0.45})`,
              );
              g.addColorStop(1, `hsla(${v.trailHue}, 100%, 60%, 0)`);
              ctx.fillStyle = g;
              ctx.beginPath();
              ctx.arc(cx + tip.x, cy - tip.y, 6 * dpr, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        }

        const scale = v.scale * (0.9 + depth * 0.35);
        ctx.save();
        ctx.translate(cx + pos.x, cy - pos.y);
        ctx.rotate(motion.angle);
        if (v.type === "plane") {
          drawPlane(ctx, scale * dpr, motion.alpha);
        } else {
          drawShip(ctx, scale * dpr, motion.alpha);
          if (!noMotion) {
            drawShipSmoke(ctx, scale * dpr, motion.alpha, t, v.phase);
          }
        }
        ctx.restore();
      }

      ctx.fillStyle = fade;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.05, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      introMo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(scrollIdleTimer);
    };
  }, [noMotion, light]);

  const pendingDrag = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    // Don't steal the gesture yet — wait to see if this is a scroll or a drag
    pendingDrag.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
    };
    lastPointer.current = { x: e.clientX, y: e.clientY };
    velocity.current = { y: 0, x: 0 };
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) {
      const pending = pendingDrag.current;
      if (!pending || pending.pointerId !== e.pointerId) return;

      const dx = e.clientX - pending.x;
      const dy = e.clientY - pending.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 10) return;

      // Vertical movement = page scroll — release and don't rotate the globe
      if (Math.abs(dy) > Math.abs(dx) * 1.15) {
        pendingDrag.current = null;
        return;
      }

      dragging.current = true;
      pendingDrag.current = null;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };

    const yawDelta = dx * 0.005;
    const pitchDelta = dy * 0.004;
    rotY.current += yawDelta;
    rotX.current = Math.max(-0.55, Math.min(0.55, rotX.current + pitchDelta));
    velocity.current = { y: yawDelta * 0.4, x: pitchDelta * 0.25 };
  }, []);

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    pendingDrag.current = null;
    if (!dragging.current) return;
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full min-h-[320px] sm:min-h-[420px] lg:min-h-[560px] xl:min-h-[640px] select-none cursor-grab active:cursor-grabbing touch-pan-y"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="img"
      aria-label="Interactive dotted world map globe. Drag to rotate."
    >
      <div className="pointer-events-none absolute inset-[8%] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(0,123,255,0.2),transparent_65%)] blur-2xl" />
      <div className="pointer-events-none absolute inset-[14%] rounded-full border border-[#007bff]/10" />
      <div className="pointer-events-none absolute inset-[24%] rounded-full border border-slate-200/35" />

      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-medium text-gray-400 bg-white/70 backdrop-blur-sm px-2.5 py-1 rounded-full border border-gray-100/80 lg:left-auto lg:right-4 lg:translate-x-0">
        Drag to explore
      </p>
    </div>
  );
}
