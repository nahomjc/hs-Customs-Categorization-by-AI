"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useReducedMotion } from "framer-motion";

type GlyphKind = "crate" | "doc" | "chip";

type GlobePoint = {
  id: string;
  kind: GlyphKind;
  accent: boolean;
  theta: number;
  phi: number;
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

const POINT_COUNT = 220;
const GLOBE_SIZE = 720;

function fibonacciSphere(count: number): GlobePoint[] {
  const points: GlobePoint[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const kinds: GlyphKind[] = ["crate", "doc", "chip"];

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    const phi = Math.acos(Math.min(1, Math.max(-1, y)));
    const lon = Math.atan2(z, x);

    const accent =
      (lon > -0.4 && lon < 0.9 && phi > 0.7 && phi < 1.55) ||
      (lon > 1.6 && lon < 2.8 && phi > 0.85 && phi < 1.7) ||
      (lon > -2.2 && lon < -1.0 && phi > 0.9 && phi < 1.65);

    points.push({
      id: `p-${i}`,
      kind: kinds[i % kinds.length],
      accent,
      theta: lon,
      phi,
    });
  }

  return points;
}

const VEHICLES: Vehicle[] = [
  { id: "plane-1", type: "plane", lat: 0.45, lon0: 0.2, speed: 0.00055, altitude: 1.12, scale: 1.15 },
  { id: "plane-2", type: "plane", lat: -0.25, lon0: 2.1, speed: -0.00042, altitude: 1.14, scale: 1 },
  { id: "plane-3", type: "plane", lat: 0.15, lon0: 4.0, speed: 0.00038, altitude: 1.1, scale: 0.95 },
  { id: "ship-1", type: "ship", lat: 0.08, lon0: 1.0, speed: 0.00022, altitude: 1.02, scale: 1.05 },
  { id: "ship-2", type: "ship", lat: -0.12, lon0: 3.2, speed: -0.00018, altitude: 1.02, scale: 1 },
  { id: "ship-3", type: "ship", lat: 0.02, lon0: 5.0, speed: 0.00015, altitude: 1.015, scale: 0.9 },
];

function projectPoint(
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
  const y1 = y0;

  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y2 = y1 * cosX - z1 * sinX;
  const z2 = y1 * sinX + z1 * cosX;

  return { x: x1, y: y2, z: z2 };
}

function Glyph({ kind, accent, scale }: { kind: GlyphKind; accent: boolean; scale: number }) {
  const size = 10 * scale;
  const fill = accent ? "#007bff" : "rgba(148, 163, 184, 0.55)";
  const stroke = accent ? "#0056b3" : "rgba(148, 163, 184, 0.35)";

  if (kind === "crate") {
    return (
      <g>
        <rect
          x={-size / 2}
          y={-size / 2}
          width={size}
          height={size}
          rx={1.2}
          fill={fill}
          stroke={stroke}
          strokeWidth={0.6}
          opacity={accent ? 0.95 : 0.7}
        />
        <line
          x1={-size / 2}
          y1={0}
          x2={size / 2}
          y2={0}
          stroke={accent ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)"}
          strokeWidth={0.7}
        />
        <line
          x1={0}
          y1={-size / 2}
          x2={0}
          y2={size / 2}
          stroke={accent ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)"}
          strokeWidth={0.7}
        />
      </g>
    );
  }

  if (kind === "doc") {
    return (
      <g>
        <rect
          x={-size * 0.35}
          y={-size / 2}
          width={size * 0.7}
          height={size}
          rx={1}
          fill={fill}
          stroke={stroke}
          strokeWidth={0.5}
          opacity={accent ? 0.95 : 0.65}
        />
        <line
          x1={-size * 0.18}
          y1={-size * 0.15}
          x2={size * 0.18}
          y2={-size * 0.15}
          stroke="rgba(255,255,255,0.65)"
          strokeWidth={0.8}
        />
        <line
          x1={-size * 0.18}
          y1={size * 0.05}
          x2={size * 0.12}
          y2={size * 0.05}
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={0.7}
        />
      </g>
    );
  }

  return (
    <g>
      <rect
        x={-size / 2}
        y={-size * 0.32}
        width={size}
        height={size * 0.64}
        rx={1}
        fill={fill}
        stroke={stroke}
        strokeWidth={0.5}
        opacity={accent ? 0.95 : 0.65}
      />
      {[-0.28, -0.12, 0.04, 0.2].map((ox) => (
        <line
          key={ox}
          x1={size * ox}
          y1={-size * 0.2}
          x2={size * ox}
          y2={size * 0.2}
          stroke="rgba(255,255,255,0.7)"
          strokeWidth={0.7}
        />
      ))}
    </g>
  );
}

function PlaneIcon({ scale }: { scale: number }) {
  const s = 16 * scale;
  return (
    <g>
      {/* Wings */}
      <path
        d={`
          M ${-s * 0.08} ${-s * 0.08}
          L ${-s * 0.42} ${-s * 0.55}
          L ${-s * 0.28} ${-s * 0.55}
          L ${s * 0.12} ${-s * 0.1}
          L ${s * 0.12} ${s * 0.1}
          L ${-s * 0.28} ${s * 0.55}
          L ${-s * 0.42} ${s * 0.55}
          L ${-s * 0.08} ${s * 0.08}
          Z
        `}
        fill="#007bff"
        stroke="#0056b3"
        strokeWidth={0.6}
        strokeLinejoin="round"
      />
      {/* Fuselage */}
      <path
        d={`
          M ${s * 0.52} 0
          C ${s * 0.52} ${-s * 0.08} ${s * 0.35} ${-s * 0.1} ${s * 0.2} ${-s * 0.1}
          L ${-s * 0.35} ${-s * 0.09}
          L ${-s * 0.55} ${-s * 0.22}
          L ${-s * 0.48} ${-s * 0.05}
          L ${-s * 0.48} ${s * 0.05}
          L ${-s * 0.55} ${s * 0.22}
          L ${-s * 0.35} ${s * 0.09}
          L ${s * 0.2} ${s * 0.1}
          C ${s * 0.35} ${s * 0.1} ${s * 0.52} ${s * 0.08} ${s * 0.52} 0
          Z
        `}
        fill="#0e1526"
      />
      {/* Nose highlight */}
      <ellipse cx={s * 0.38} cy={0} rx={s * 0.1} ry={s * 0.045} fill="#38bdf8" opacity={0.9} />
      {/* Cabin windows */}
      <line
        x1={-s * 0.05}
        y1={0}
        x2={s * 0.22}
        y2={0}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1.1}
        strokeLinecap="round"
      />
    </g>
  );
}

function ShipIcon({ scale }: { scale: number }) {
  const s = 15 * scale;
  return (
    <g>
      {/* Hull */}
      <path
        d={`
          M ${-s * 0.58} ${s * 0.08}
          L ${s * 0.42} ${s * 0.08}
          L ${s * 0.58} ${-s * 0.02}
          L ${s * 0.42} ${s * 0.32}
          L ${-s * 0.35} ${s * 0.32}
          L ${-s * 0.55} ${s * 0.18}
          Z
        `}
        fill="#007bff"
        stroke="#0056b3"
        strokeWidth={0.5}
        strokeLinejoin="round"
      />
      {/* Waterline stripe */}
      <line
        x1={-s * 0.5}
        y1={s * 0.16}
        x2={s * 0.4}
        y2={s * 0.16}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={0.9}
      />
      {/* Container stacks */}
      <rect x={-s * 0.42} y={-s * 0.12} width={s * 0.18} height={s * 0.2} rx={0.6} fill="#0e1526" />
      <rect x={-s * 0.22} y={-s * 0.18} width={s * 0.18} height={s * 0.26} rx={0.6} fill="#1e293b" />
      <rect x={-s * 0.02} y={-s * 0.12} width={s * 0.18} height={s * 0.2} rx={0.6} fill="#0e1526" />
      {/* Bridge / superstructure */}
      <rect
        x={s * 0.2}
        y={-s * 0.28}
        width={s * 0.2}
        height={s * 0.36}
        rx={0.8}
        fill="#0e1526"
      />
      {/* Bridge windows */}
      <rect
        x={s * 0.23}
        y={-s * 0.22}
        width={s * 0.14}
        height={s * 0.07}
        rx={0.4}
        fill="#38bdf8"
        opacity={0.9}
      />
      {/* Funnel */}
      <rect x={s * 0.26} y={-s * 0.42} width={s * 0.08} height={s * 0.14} rx={0.4} fill="#64748b" />
      <rect x={s * 0.26} y={-s * 0.42} width={s * 0.08} height={s * 0.04} rx={0.3} fill="#ef4444" />
    </g>
  );
}

type FrameState = {
  rotY: number;
  rotX: number;
  time: number;
};

export function HeroGlobeVisual({ reduced }: { reduced?: boolean }) {
  const prefersReduced = useReducedMotion() ?? false;
  const noMotion = reduced || prefersReduced;
  const points = useMemo(() => fibonacciSphere(POINT_COUNT), []);

  const rotY = useRef(0.35);
  const rotX = useRef(0.12);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const velocity = useRef({ y: 0, x: 0 });
  const [frame, setFrame] = useState<FrameState>({
    rotY: 0.35,
    rotX: 0.12,
    time: 0,
  });

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;

    const tick = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      if (!noMotion) {
        elapsed += dt;
      }

      if (!dragging.current && !noMotion) {
        rotY.current += dt * 0.00016 + velocity.current.y;
        rotX.current += velocity.current.x;
        velocity.current.y *= 0.95;
        velocity.current.x *= 0.92;
        rotX.current = Math.max(-0.55, Math.min(0.55, rotX.current));
      } else if (!dragging.current) {
        velocity.current.y *= 0.9;
        velocity.current.x *= 0.9;
      }

      setFrame({
        rotY: rotY.current,
        rotX: rotX.current,
        time: elapsed,
      });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [noMotion]);

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

  const radius = GLOBE_SIZE * 0.42;

  const projected = useMemo(() => {
    return points
      .map((p) => {
        const lat = Math.PI / 2 - p.phi;
        const lon = p.theta;
        const { x, y, z } = projectPoint(lat, lon, frame.rotY, frame.rotX, radius);
        const depth = (z + radius) / (2 * radius);
        const scale = 0.55 + depth * 0.7;
        return { ...p, x, y, z, depth, scale };
      })
      .filter((p) => p.z > -radius * 0.12)
      .sort((a, b) => a.z - b.z);
  }, [points, frame.rotY, frame.rotX, radius]);

  const vehicles = useMemo(() => {
    return VEHICLES.map((v) => {
      const lon = v.lon0 + frame.time * v.speed;
      const { x, y, z } = projectPoint(
        v.lat,
        lon,
        frame.rotY,
        frame.rotX,
        radius * v.altitude,
      );
      const ahead = projectPoint(
        v.lat,
        lon + Math.sign(v.speed || 1) * 0.08,
        frame.rotY,
        frame.rotX,
        radius * v.altitude,
      );
      const angle = Math.atan2(ahead.y - y, ahead.x - x);
      const depth = (z + radius) / (2 * radius);
      const visible = z > -radius * 0.05;
      return { ...v, x, y, z, angle, depth, visible };
    })
      .filter((v) => v.visible)
      .sort((a, b) => a.z - b.z);
  }, [frame.rotY, frame.rotX, frame.time, radius]);

  return (
    <div
      className="relative w-full h-full min-h-[320px] sm:min-h-[420px] lg:min-h-[560px] xl:min-h-[640px] select-none touch-none cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="img"
      aria-label="Interactive logistics globe. Drag to rotate."
    >
      <div className="pointer-events-none absolute inset-[8%] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(0,123,255,0.22),transparent_65%)] blur-2xl" />
      <div className="pointer-events-none absolute inset-[14%] rounded-full border border-[#007bff]/12" />
      <div className="pointer-events-none absolute inset-[24%] rounded-full border border-slate-200/40" />

      <svg
        viewBox={`${-GLOBE_SIZE / 2} ${-GLOBE_SIZE / 2} ${GLOBE_SIZE} ${GLOBE_SIZE}`}
        className="absolute inset-0 h-full w-full drop-shadow-sm"
        role="presentation"
        focusable="false"
      >
        <title>Customs and logistics globe</title>
        <defs>
          <radialGradient id="hero-globe-fade" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="70%" stopColor="rgba(248,249,250,0)" />
            <stop offset="100%" stopColor="rgba(248,249,250,0.4)" />
          </radialGradient>
          <filter id="vehicle-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#007bff" floodOpacity="0.35" />
          </filter>
        </defs>

        {[-0.55, 0, 0.55].map((band) => (
          <ellipse
            key={band}
            cx={0}
            cy={band * GLOBE_SIZE * 0.28}
            rx={GLOBE_SIZE * 0.38 * Math.cos(band * 0.9)}
            ry={GLOBE_SIZE * 0.12}
            fill="none"
            stroke="rgba(148,163,184,0.16)"
            strokeWidth={1}
          />
        ))}

        <ellipse
          cx={0}
          cy={GLOBE_SIZE * 0.02}
          rx={GLOBE_SIZE * 0.4}
          ry={GLOBE_SIZE * 0.09}
          fill="none"
          stroke="rgba(0,123,255,0.15)"
          strokeWidth={1.2}
          strokeDasharray="4 6"
        />

        {projected.map((p) => (
          <g
            key={p.id}
            transform={`translate(${p.x}, ${p.y})`}
            opacity={0.35 + p.depth * 0.65}
          >
            <Glyph kind={p.kind} accent={p.accent} scale={p.scale} />
          </g>
        ))}

        {vehicles.map((v) => (
          <g
            key={v.id}
            transform={`translate(${v.x}, ${v.y}) rotate(${(v.angle * 180) / Math.PI})`}
            opacity={0.45 + v.depth * 0.55}
            filter="url(#vehicle-glow)"
          >
            {v.type === "plane" ? (
              <PlaneIcon scale={v.scale * (0.7 + v.depth * 0.5)} />
            ) : (
              <ShipIcon scale={v.scale * (0.7 + v.depth * 0.5)} />
            )}
          </g>
        ))}

        <circle
          cx={0}
          cy={0}
          r={GLOBE_SIZE * 0.44}
          fill="url(#hero-globe-fade)"
          pointerEvents="none"
        />
      </svg>

      <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-medium text-gray-400 bg-white/70 backdrop-blur-sm px-2.5 py-1 rounded-full border border-gray-100/80 lg:left-auto lg:right-4 lg:translate-x-0">
        Drag to explore
      </p>
    </div>
  );
}
