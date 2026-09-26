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

type LandDot = {
  lat: number;
  lon: number;
  inland: number;
  region: number;
};

type Vehicle = {
  id: string;
  type: "plane" | "ship";
  lat: number;
  lon0: number;
  speed: number;
  altitude: number;
  scale: number;
};

type RegionDef = {
  id: string;
  /** Soft brand-safe regional tint */
  rgb: readonly [number, number, number];
  /** Approx center lon (rad) — used to sync glow with facing side */
  centerLon: number;
  test: (lonDeg: number, latDeg: number) => boolean;
};

/** Face Africa / Europe — most recognizable silhouette */
const INITIAL_ROT_Y = -0.32;
const INITIAL_ROT_X = 0.1;

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

const VEHICLES: Vehicle[] = [
  { id: "plane-1", type: "plane", lat: 0.42, lon0: 0.3, speed: 0.00072, altitude: 1.13, scale: 1.12 },
  { id: "plane-2", type: "plane", lat: -0.22, lon0: 2.2, speed: -0.00058, altitude: 1.15, scale: 1 },
  { id: "plane-3", type: "plane", lat: 0.18, lon0: 4.1, speed: 0.0005, altitude: 1.11, scale: 0.92 },
  { id: "ship-1", type: "ship", lat: 0.06, lon0: 1.1, speed: 0.00028, altitude: 1.02, scale: 1.02 },
  { id: "ship-2", type: "ship", lat: -0.1, lon0: 3.3, speed: -0.00022, altitude: 1.02, scale: 0.95 },
  { id: "ship-3", type: "ship", lat: 0.02, lon0: 5.1, speed: 0.0002, altitude: 1.015, scale: 0.88 },
];

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

function smoothToward(current: number, target: number, dt: number, rate: number) {
  const k = 1 - Math.exp(-rate * dt);
  return current + (target - current) * k;
}

/** Prebaked Natural Earth land samples: [latRad, lonRad, accent, inland] */
const LAND_DOTS: LandDot[] = (landDotsRaw as [number, number, number, number][]).map(
  ([lat, lon, , inland]) => {
    const lonDeg = (lon * 180) / Math.PI;
    const latDeg = (lat * 180) / Math.PI;
    return {
      lat,
      lon,
      inland,
      region: regionIndexFor(lonDeg, latDeg),
    };
  },
);

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

function drawShip(
  ctx: CanvasRenderingContext2D,
  scale: number,
  alpha: number,
) {
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

export function HeroGlobeVisual({ reduced }: { reduced?: boolean }) {
  const prefersReduced = useReducedMotion() ?? false;
  const noMotion = reduced || prefersReduced;

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotY = useRef(INITIAL_ROT_Y);
  const rotX = useRef(INITIAL_ROT_X);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const velocity = useRef({ y: 0, x: 0 });
  const timeRef = useRef(0);
  const vehicleMotion = useRef<Record<string, VehicleMotion>>({});

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

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let dpr = 1;
    const visibleBuf: {
      p: LandDot;
      x: number;
      y: number;
      z: number;
      glow: number;
    }[] = [];
    let visibleCount = 0;

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

      fadeGrad = ctx.createRadialGradient(cx, cy, radius * 0.72, cx, cy, radius * 1.02);
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
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      bloomGrad = null;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const tick = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      if (!noMotion) timeRef.current += dt;

      if (!dragging.current && !noMotion) {
        // Steady, constant spin — avoids micro-stutter from velocity noise
        rotY.current += dt * 0.00011 + velocity.current.y;
        rotX.current += velocity.current.x;
        velocity.current.y *= 0.92;
        velocity.current.x *= 0.9;
        rotX.current = Math.max(-0.55, Math.min(0.55, rotX.current));
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

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = bloomGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = oceanGrad;
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
      ctx.ellipse(cx, cy + radius * 0.02, radius * 0.98, radius * 0.24, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Land dots — regional colors + soft pulse glow cycling nations
      const rotYNow = rotY.current;
      const rotXNow = rotX.current;
      const lx = light.x;
      const ly = light.y;
      const lz = light.z;
      const t = timeRef.current;
      const frontLon = -rotYNow;

      // Cycle which region is "active", with a smooth sine breath
      const cyclePos = noMotion ? 0 : t / REGION_CYCLE_MS;
      const activeIdx = Math.floor(cyclePos) % REGIONS.length;
      const nextIdx = (activeIdx + 1) % REGIONS.length;
      const phase = cyclePos - Math.floor(cyclePos); // 0..1 within cycle
      // Ease: glow up mid-cycle, soft handoff near the end
      const breath = Math.sin(phase * Math.PI); // 0→1→0
      const handoff = phase > 0.78 ? (phase - 0.78) / 0.22 : 0;

      // Camera boost: regions facing us glow a bit more
      const faceBoost = (regionIdx: number) => {
        if (regionIdx < 0) return 0;
        const d = Math.abs(shortestLonDelta(REGIONS[regionIdx].centerLon, frontLon));
        return Math.max(0, 1 - d / 1.1);
      };

      const glowOf = (regionIdx: number) => {
        if (regionIdx < 0 || noMotion) return 0;
        let g = 0;
        if (regionIdx === activeIdx) g = breath * (1 - handoff * 0.85);
        if (regionIdx === nextIdx) g = Math.max(g, handoff * breath);
        // Blend with facing so rotation feels connected
        g = Math.max(g * 0.75, g * 0.45 + faceBoost(regionIdx) * 0.55 * 0.35);
        return Math.min(1, g);
      };

      // Project once, then draw glow + cores
      visibleCount = 0;
      for (const p of LAND_DOTS) {
        const { x, y, z } = project(p.lat, p.lon, rotYNow, rotXNow, radius);
        if (z <= 0) continue;
        const slot = visibleBuf[visibleCount];
        if (slot) {
          slot.p = p;
          slot.x = x;
          slot.y = y;
          slot.z = z;
          slot.glow = glowOf(p.region);
        } else {
          visibleBuf[visibleCount] = { p, x, y, z, glow: glowOf(p.region) };
        }
        visibleCount++;
      }

      // Soft glow halos for lit regions
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < visibleCount; i++) {
        const v = visibleBuf[i];
        if (v.glow < 0.08 || v.p.region < 0) continue;
        const depth = v.z / radius;
        const [cr, cg, cb] = REGIONS[v.p.region].rgb;
        const gr =
          (1.8 + (1 - v.p.inland) * 1.2) * (0.75 + depth * 0.5) * dpr * (0.7 + v.glow * 0.9);
        const gaq = Math.round(0.1 * v.glow * (0.45 + depth * 0.55) * 25) / 25;
        if (gaq < 0.02) continue;
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${gaq})`;
        ctx.beginPath();
        ctx.arc(cx + v.x, cy - v.y, gr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Region-tinted cores
      for (let i = 0; i < visibleCount; i++) {
        const v = visibleBuf[i];
        const invR = 1 / radius;
        const lit = Math.max(0, v.x * invR * lx + v.y * invR * ly + v.z * invR * lz);
        const depth = v.z * invR;
        const shade = 0.42 + lit * 0.58;
        const { glow, p } = v;

        const baseR = 0.88 + (1 - p.inland) * 0.28 + glow * 0.55;
        const r = Math.max(0.65 * dpr, baseR * (0.7 + depth * 0.45) * dpr);
        const aq = Math.round((0.38 + depth * 0.55 + glow * 0.35) * shade * 20) / 20;

        if (p.region >= 0) {
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

      // Vehicles — smoothed heading + soft limb fade (no hard pop)
      const lookAhead = 0.12;
      for (const v of VEHICLES) {
        const lon = v.lon0 + timeRef.current * v.speed;
        const pos = project(v.lat, lon, rotYNow, rotXNow, radius * v.altitude);
        const ahead = project(
          v.lat,
          lon + Math.sign(v.speed || 1) * lookAhead,
          rotYNow,
          rotXNow,
          radius * v.altitude,
        );

        const depth = (pos.z + radius) / (2 * radius);
        // Soft visibility: fade out near the back edge instead of vanishing
        const targetAlpha =
          pos.z < -radius * 0.15
            ? 0
            : Math.max(0, Math.min(1, (pos.z + radius * 0.12) / (radius * 0.55))) *
              (0.6 + depth * 0.4);

        let motion = vehicleMotion.current[v.id];
        if (!motion) {
          motion = { angle: 0, alpha: 0, initialized: false };
          vehicleMotion.current[v.id] = motion;
        }

        const dx = ahead.x - pos.x;
        const dy = -(ahead.y - pos.y);
        const len = Math.hypot(dx, dy);
        // Only trust heading when projection has enough screen length
        if (len > radius * 0.012) {
          const targetAngle = Math.atan2(dy, dx);
          if (!motion.initialized) {
            motion.angle = targetAngle;
            motion.initialized = true;
          } else {
            motion.angle = lerpAngle(motion.angle, targetAngle, 1 - Math.exp(-0.014 * dt));
          }
        }

        motion.alpha = smoothToward(motion.alpha, targetAlpha, dt, 0.01);
        if (motion.alpha < 0.02) continue;

        const scale = v.scale * (0.88 + depth * 0.4);

        ctx.save();
        ctx.translate(cx + pos.x, cy - pos.y);
        ctx.rotate(motion.angle);
        if (v.type === "plane") drawPlane(ctx, scale * dpr, motion.alpha);
        else drawShip(ctx, scale * dpr, motion.alpha);
        ctx.restore();
      }

      ctx.fillStyle = fadeGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.05, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = rimGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [noMotion, light]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    velocity.current = { y: 0, x: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };

    const yawDelta = dx * 0.005;
    // Drag down tips the north edge toward you (natural with screen Y-down)
    const pitchDelta = dy * 0.004;
    rotY.current += yawDelta;
    rotX.current = Math.max(-0.55, Math.min(0.55, rotX.current + pitchDelta));
    velocity.current = { y: yawDelta * 0.4, x: pitchDelta * 0.25 };
  }, []);

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
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
      className="relative w-full h-full min-h-[320px] sm:min-h-[420px] lg:min-h-[560px] xl:min-h-[640px] select-none touch-none cursor-grab active:cursor-grabbing"
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
