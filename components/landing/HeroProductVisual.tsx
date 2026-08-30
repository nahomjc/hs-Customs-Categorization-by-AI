"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { easeOut, floatAnimation } from "./motion";

const PHASE_MS = 4200;

const phases = [
  { id: "upload", label: "Upload" },
  { id: "classify", label: "Classify" },
  { id: "export", label: "Export" },
] as const;

const classifiedRows = [
  { item: "Floor standing lamp", hs: "9405.20", qty: 12 },
  { item: "Cafe chair — walnut", hs: "9401.61", qty: 48 },
  { item: "Ceiling fan 52in", hs: "8414.51", qty: 24 },
];

const lineItems = [
  "Floor standing lamp",
  "Cafe chair — walnut",
  "Wall covering roll",
  "Ceiling fan 52in",
  "Ceramic vase",
  "LED desk lamp",
];

function TrafficLights() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
    </div>
  );
}

function PhasePills({ active }: { active: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-4">
      {phases.map((phase, i) => {
        const isActive = i === active;
        const isDone = i < active;
        return (
          <div key={phase.id} className="flex items-center gap-2">
            <motion.div
              layout
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                isActive
                  ? "bg-[#007bff] text-white shadow-md shadow-blue-500/25"
                  : isDone
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-white/60 text-gray-500 border border-white/80"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold ${
                  isActive
                    ? "bg-white/25"
                    : isDone
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-200/80 text-gray-600"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </span>
              {phase.label}
            </motion.div>
            {i < phases.length - 1 && (
              <span
                className={`hidden sm:block w-4 h-px ${isDone ? "bg-emerald-300" : "bg-gray-200"}`}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OrbitCard({
  children,
  className,
  delay = 0,
  reduced,
}: {
  children: ReactNode;
  className: string;
  delay?: number;
  reduced: boolean;
}) {
  return (
    <motion.div
      className={`absolute z-20 ${className}`}
      initial={{ opacity: 0, scale: 0.88, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, duration: 0.65, ease: easeOut }}
    >
      <motion.div animate={floatAnimation(reduced)} transition={{ delay: delay + 0.4 }}>
        {children}
      </motion.div>
    </motion.div>
  );
}

function UploadPhase() {
  return (
    <motion.div
      key="upload"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, y: -8 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="min-h-[260px] flex flex-col items-center justify-center px-2"
    >
      <motion.div
        className="w-full rounded-xl border-2 border-dashed border-[#007bff]/40 bg-blue-50/40 p-6 text-center"
        animate={{
          borderColor: [
            "rgba(0,123,255,0.3)",
            "rgba(0,123,255,0.65)",
            "rgba(0,123,255,0.3)",
          ],
        }}
        transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY }}
      >
        <motion.div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#007bff] text-white shadow-lg shadow-blue-500/30"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <title>Upload</title>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </motion.div>
        <p className="text-sm font-semibold text-gray-800">Drop your packing list</p>
        <p className="text-xs text-gray-500 mt-1">PDF, Word, or Excel</p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm border border-gray-100"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
          packing_list_q4.pdf
        </motion.div>
      </motion.div>
      <p className="mt-4 text-[10px] text-gray-400">Parsing 847 line items…</p>
    </motion.div>
  );
}

function ClassifyPhase() {
  return (
    <motion.div
      key="classify"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="min-h-[260px]"
    >
      <div className="rounded-xl landing-glass-panel overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/50 bg-white/40">
          <p className="text-[11px] font-semibold text-gray-700">AI classifying line items</p>
          <span className="flex items-center gap-1 rounded-full bg-[#007bff]/10 px-2 py-0.5 text-[9px] font-semibold text-[#007bff]">
            <span className="h-1 w-1 rounded-full bg-[#007bff] animate-pulse" />
            Live
          </span>
        </div>
        <div className="p-2 space-y-1 max-h-[140px] overflow-hidden">
          {lineItems.map((item, i) => (
            <motion.div
              key={item}
              className="flex items-center justify-between rounded-lg bg-white/60 px-2.5 py-1.5"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.35 }}
            >
              <span className="text-[10px] text-gray-600 truncate max-w-[130px]">{item}</span>
              <motion.span
                className="text-[9px] font-bold text-[#007bff] tabular-nums"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                {i < 4 ? classifiedRows[i % 3]?.hs ?? "—" : "···"}
              </motion.span>
            </motion.div>
          ))}
        </div>
        <div className="px-3 pb-3">
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#007bff] to-indigo-500"
              initial={{ width: "8%" }}
              animate={{ width: ["8%", "92%", "78%"] }}
              transition={{ duration: 3, ease: "easeInOut" }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ExportPhase() {
  return (
    <motion.div
      key="export"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="min-h-[260px]"
    >
      <div className="rounded-xl overflow-hidden border border-emerald-100 bg-white/70">
        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 border-b border-emerald-100">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-600 text-[8px] font-bold text-white">
            X
          </div>
          <p className="text-[11px] font-semibold text-emerald-900">grouped_export.xlsx</p>
        </div>
        <div className="p-2">
          <div className="grid grid-cols-3 gap-px bg-gray-200 rounded overflow-hidden text-[9px]">
            <div className="bg-gray-100 px-2 py-1.5 font-semibold text-gray-600">HS</div>
            <div className="bg-gray-100 px-2 py-1.5 font-semibold text-gray-600">Item</div>
            <div className="bg-gray-100 px-2 py-1.5 font-semibold text-gray-600">Qty</div>
            {classifiedRows.map((row, i) => (
              <motion.div key={row.hs} className="contents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}>
                <div className="bg-white px-2 py-1.5 font-bold text-[#007bff]">{row.hs}</div>
                <div className="bg-white px-2 py-1.5 text-gray-600 truncate">{row.item}</div>
                <div className="bg-white px-2 py-1.5 text-gray-600">{row.qty}</div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="px-3 pb-3">
          <motion.div
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-[11px] font-bold text-white shadow-lg shadow-emerald-500/25"
            initial={{ scale: 0.95 }}
            animate={{ scale: [0.95, 1.02, 1] }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <title>Download</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Declaration-ready · Download
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function useTilt(reduced: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useTransform(my, [-0.5, 0.5], [7, -7]);
  const rotateY = useTransform(mx, [-0.5, 0.5], [-7, 7]);

  const onMouseMove = (e: MouseEvent) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const onMouseLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return { ref, rotateX, rotateY, onMouseMove, onMouseLeave };
}

export function HeroProductVisual({ reduced }: { reduced: boolean }) {
  const [phase, setPhase] = useState(0);
  const tilt = useTilt(reduced);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setPhase((p) => (p + 1) % phases.length);
    }, PHASE_MS);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none perspective-[1200px]">
      <div
        className="pointer-events-none absolute -inset-10 rounded-[3rem] bg-gradient-to-br from-[#007bff]/25 via-sky-300/10 to-violet-400/15 blur-3xl"
        aria-hidden="true"
      />

      {/* Orbit cards */}
      <OrbitCard reduced={reduced} delay={0.6} className="-left-3 sm:-left-8 top-6 hidden sm:block">
        <div className="landing-float-card rounded-xl bg-white px-3 py-2.5 border border-gray-100 shadow-xl">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 text-xs font-bold">✓</span>
            <div>
              <p className="text-[10px] font-semibold text-gray-800">847 lines parsed</p>
              <p className="text-[9px] text-gray-400">2.4s · PDF upload</p>
            </div>
          </div>
        </div>
      </OrbitCard>

      <OrbitCard reduced={reduced} delay={0.75} className="-right-2 sm:-right-7 top-20">
        <div className="landing-float-card rounded-xl bg-gradient-to-br from-[#007bff] to-indigo-600 px-3 py-2 shadow-xl shadow-blue-500/30">
          <p className="text-[10px] font-bold text-white">AI classifying</p>
          <div className="mt-1.5 h-1 w-20 rounded-full bg-white/30 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-white"
              animate={reduced ? undefined : { width: ["15%", "90%", "70%"] }}
              transition={{ duration: 2.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            />
          </div>
        </div>
      </OrbitCard>

      <OrbitCard reduced={reduced} delay={0.9} className="-left-2 sm:-left-6 bottom-20 hidden md:block">
        <div className="landing-float-card rounded-xl bg-white p-2.5 border border-gray-100">
          <p className="text-[9px] font-semibold text-gray-500 mb-1.5">Export formats</p>
          <div className="flex gap-1">
            {["XLS", "PDF", "CSV"].map((fmt) => (
              <span key={fmt} className="rounded-md bg-emerald-50 px-2 py-1 text-[8px] font-bold text-emerald-700">{fmt}</span>
            ))}
          </div>
        </div>
      </OrbitCard>

      <OrbitCard reduced={reduced} delay={1.05} className="-right-3 sm:-right-8 bottom-6">
        <div className="landing-float-card rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 -rotate-2">
          <p className="text-[10px] font-semibold text-amber-900">Declaration-ready</p>
          <p className="text-[9px] text-amber-700/80">Grouped by HS code</p>
        </div>
      </OrbitCard>

      {/* 3D tilt window */}
      <motion.div
        ref={tilt.ref}
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={tilt.onMouseLeave}
        style={{
          rotateX: reduced ? 0 : tilt.rotateX,
          rotateY: reduced ? 0 : tilt.rotateY,
          transformStyle: "preserve-3d",
        }}
        className="relative"
        initial={{ opacity: 0, y: 40, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.85, ease: easeOut }}
      >
        <div className="landing-glass-window relative rounded-2xl overflow-hidden shadow-2xl shadow-blue-500/15 ring-1 ring-white/60">
          {/* Scan line */}
          {!reduced && (
            <div className="hero-scan-line pointer-events-none absolute left-0 right-0 z-30 h-px bg-gradient-to-r from-transparent via-[#007bff]/50 to-transparent" aria-hidden />
          )}

          <div className="landing-glass-titlebar flex items-center gap-3 px-4 py-2.5">
            <TrafficLights />
            <span className="flex-1 text-center text-[11px] font-medium text-gray-600 truncate">
              Impact Logistics — HS Workspace
            </span>
            <div className="w-12" aria-hidden />
          </div>

          <div className="relative bg-white/35 backdrop-blur-sm p-4 sm:p-5">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#007bff]/6 via-transparent to-indigo-400/5" aria-hidden />

            <PhasePills active={phase} />

            <AnimatePresence mode="wait">
              {phase === 0 && <UploadPhase />}
              {phase === 1 && <ClassifyPhase />}
              {phase === 2 && <ExportPhase />}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
