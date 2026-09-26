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
  accent: boolean;
  inland: number;
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

/** Face Africa / Europe — most recognizable silhouette */
const INITIAL_ROT_Y = -0.32;
const INITIAL_ROT_X = 0.1;

const VEHICLES: Vehicle[] = [
  { id: "plane-1", type: "plane", lat: 0.42, lon0: 0.3, speed: 0.00055, altitude: 1.13, scale: 1.12 },
  { id: "plane-2", type: "plane", lat: -0.22, lon0: 2.2, speed: -0.00042, altitude: 1.15, scale: 1 },
  { id: "plane-3", type: "plane", lat: 0.18, lon0: 4.1, speed: 0.00038, altitude: 1.11, scale: 0.92 },
  { id: "ship-1", type: "ship", lat: 0.06, lon0: 1.1, speed: 0.0002, altitude: 1.02, scale: 1.02 },
  { id: "ship-2", type: "ship", lat: -0.1, lon0: 3.3, speed: -0.00016, altitude: 1.02, scale: 0.95 },
  { id: "ship-3", type: "ship", lat: 0.02, lon0: 5.1, speed: 0.00014, altitude: 1.015, scale: 0.88 },
];

/** Prebaked Natural Earth land samples: [latRad, lonRad, accent, inland] */
const LAND_DOTS: LandDot[] = (landDotsRaw as [number, number, number, number][]).map(
  ([lat, lon, accent, inland]) => ({
    lat,
    lon,
    accent: accent === 1,
    inland,
  }),
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

function drawPlane(
  ctx: CanvasRenderingContext2D,
  scale: number,
  alpha: number,
) {
  const s = 15 * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#007bff";
  ctx.strokeStyle = "#0056b3";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-s * 0.08, -s * 0.08);
  ctx.lineTo(-s * 0.42, -s * 0.55);
  ctx.lineTo(-s * 0.28, -s * 0.55);
  ctx.lineTo(s * 0.12, -s * 0.1);
  ctx.lineTo(s * 0.12, s * 0.1);
  ctx.lineTo(-s * 0.28, s * 0.55);
  ctx.lineTo(-s * 0.42, s * 0.55);
  ctx.lineTo(-s * 0.08, s * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0e1526";
  ctx.beginPath();
  ctx.moveTo(s * 0.52, 0);
  ctx.bezierCurveTo(s * 0.52, -s * 0.08, s * 0.35, -s * 0.1, s * 0.2, -s * 0.1);
  ctx.lineTo(-s * 0.35, -s * 0.09);
  ctx.lineTo(-s * 0.55, -s * 0.22);
  ctx.lineTo(-s * 0.48, -s * 0.05);
  ctx.lineTo(-s * 0.48, s * 0.05);
  ctx.lineTo(-s * 0.55, s * 0.22);
  ctx.lineTo(-s * 0.35, s * 0.09);
  ctx.lineTo(s * 0.2, s * 0.1);
  ctx.bezierCurveTo(s * 0.35, s * 0.1, s * 0.52, s * 0.08, s * 0.52, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.ellipse(s * 0.38, 0, s * 0.1, s * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShip(
  ctx: CanvasRenderingContext2D,
  scale: number,
  alpha: number,
) {
  const s = 14 * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#007bff";
  ctx.beginPath();
  ctx.moveTo(-s * 0.58, s * 0.08);
  ctx.lineTo(s * 0.42, s * 0.08);
  ctx.lineTo(s * 0.58, -s * 0.02);
  ctx.lineTo(s * 0.42, s * 0.32);
  ctx.lineTo(-s * 0.35, s * 0.32);
  ctx.lineTo(-s * 0.55, s * 0.18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#0e1526";
  ctx.fillRect(-s * 0.42, -s * 0.12, s * 0.18, s * 0.2);
  ctx.fillRect(-s * 0.22, -s * 0.18, s * 0.18, s * 0.26);
  ctx.fillRect(-s * 0.02, -s * 0.12, s * 0.18, s * 0.2);
  ctx.fillRect(s * 0.2, -s * 0.28, s * 0.2, s * 0.36);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(s * 0.23, -s * 0.22, s * 0.14, s * 0.07);
  ctx.fillStyle = "#64748b";
  ctx.fillRect(s * 0.26, -s * 0.42, s * 0.08, s * 0.14);
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(s * 0.26, -s * 0.42, s * 0.08, s * 0.04);
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

  const light = useMemo(() => {
    const lx = -0.4;
    const ly = 0.55; // screen-up after Y flip
    const lz = 0.75;
    const len = Math.hypot(lx, ly, lz);
    return { x: lx / len, y: ly / len, z: lz / len };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let dpr = 1;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const tick = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      if (!noMotion) timeRef.current += dt;

      if (!dragging.current && !noMotion) {
        rotY.current += dt * 0.00012 + velocity.current.y;
        rotX.current += velocity.current.x;
        velocity.current.y *= 0.94;
        velocity.current.x *= 0.91;
        rotX.current = Math.max(-0.55, Math.min(0.55, rotX.current));
      } else if (!dragging.current) {
        velocity.current.y *= 0.9;
        velocity.current.x *= 0.9;
      }

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.42;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const bloom = ctx.createRadialGradient(
        cx - radius * 0.25,
        cy - radius * 0.3,
        radius * 0.1,
        cx,
        cy,
        radius * 1.15,
      );
      bloom.addColorStop(0, "rgba(0,123,255,0.16)");
      bloom.addColorStop(0.45, "rgba(0,123,255,0.04)");
      bloom.addColorStop(1, "rgba(0,123,255,0)");
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.2, 0, Math.PI * 2);
      ctx.fill();

      const ocean = ctx.createRadialGradient(
        cx - radius * 0.35,
        cy - radius * 0.4,
        radius * 0.05,
        cx,
        cy,
        radius,
      );
      ocean.addColorStop(0, "rgba(241,245,249,0.95)");
      ocean.addColorStop(0.55, "rgba(226,232,240,0.72)");
      ocean.addColorStop(1, "rgba(203,213,225,0.55)");
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
      ctx.ellipse(cx, cy + radius * 0.02, radius * 0.98, radius * 0.24, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Land dots — canvas Y is flipped so north is up (cy - y)
      for (const p of LAND_DOTS) {
        const { x, y, z } = project(p.lat, p.lon, rotY.current, rotX.current, radius);
        if (z <= 0) continue;

        const nx = x / radius;
        const ny = y / radius;
        const nz = z / radius;
        // light.y is screen-up; 3D +Y is north, matches after we flip draw Y
        const lit = Math.max(0, nx * light.x + ny * light.y + nz * light.z);
        const depth = z / radius;
        const shade = 0.42 + lit * 0.58;

        const baseR = (p.accent ? 1.05 : 0.9) + (1 - p.inland) * 0.28;
        const r = Math.max(0.7 * dpr, baseR * (0.7 + depth * 0.45) * dpr);
        const a = (0.4 + depth * 0.6) * shade;

        if (p.accent) {
          ctx.fillStyle = `rgba(0,${Math.round(110 + lit * 30)},${Math.round(200 + lit * 40)},${a})`;
        } else {
          const g = Math.round(78 + lit * 45);
          ctx.fillStyle = `rgba(${g - 4},${g},${g + 12},${a})`;
        }
        ctx.beginPath();
        ctx.arc(cx + x, cy - y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const v of VEHICLES) {
        const lon = v.lon0 + timeRef.current * v.speed;
        const pos = project(v.lat, lon, rotY.current, rotX.current, radius * v.altitude);
        if (pos.z < -radius * 0.02) continue;
        const ahead = project(
          v.lat,
          lon + Math.sign(v.speed || 1) * 0.08,
          rotY.current,
          rotX.current,
          radius * v.altitude,
        );
        // Flip Y for screen-space heading
        const angle = Math.atan2(-(ahead.y - pos.y), ahead.x - pos.x);
        const depth = (pos.z + radius) / (2 * radius);
        const alpha = 0.4 + depth * 0.55;
        const scale = v.scale * (0.7 + depth * 0.5);

        ctx.save();
        ctx.translate(cx + pos.x, cy - pos.y);
        ctx.rotate(angle);
        ctx.shadowColor = "rgba(0,123,255,0.35)";
        ctx.shadowBlur = 6 * dpr;
        if (v.type === "plane") drawPlane(ctx, scale * dpr, alpha);
        else drawShip(ctx, scale * dpr, alpha);
        ctx.restore();
      }

      const fade = ctx.createRadialGradient(cx, cy, radius * 0.72, cx, cy, radius * 1.02);
      fade.addColorStop(0, "rgba(248,249,250,0)");
      fade.addColorStop(0.7, "rgba(248,249,250,0)");
      fade.addColorStop(1, "rgba(248,249,250,0.55)");
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.05, 0, Math.PI * 2);
      ctx.fillStyle = fade;
      ctx.fill();

      const rim = ctx.createRadialGradient(
        cx - radius * 0.4,
        cy - radius * 0.45,
        0,
        cx - radius * 0.2,
        cy - radius * 0.25,
        radius * 0.7,
      );
      rim.addColorStop(0, "rgba(255,255,255,0.28)");
      rim.addColorStop(0.35, "rgba(255,255,255,0.08)");
      rim.addColorStop(1, "rgba(255,255,255,0)");
      ctx.globalCompositeOperation = "screen";
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = rim;
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
