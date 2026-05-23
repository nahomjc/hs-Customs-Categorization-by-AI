"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { easeOut } from "./motion";

const PHASE_MS = 4800;

const steps = [
  { id: "upload", label: "Upload PDF" },
  { id: "classify", label: "AI classifying" },
  { id: "list", label: "Grouped list" },
] as const;

const groupedRows = [
  { hs: "9405", category: "Lighting", desc: "Floor standing lamp", qty: 12 },
  { hs: "9401", category: "Chairs & seating", desc: "Cafe chair", qty: 48 },
  { hs: "4814", category: "Textile/wallpaper", desc: "Wall covering roll", qty: 6 },
  { hs: "8414", category: "HVAC (AC/fans)", desc: "Ceiling fan", qty: 24 },
];

const lineItems = [
  "Floor standing lamp",
  "Cafe chair — walnut",
  "Wall covering roll",
  "Ceiling fan 52in",
  "Ceramic vase",
  "LED desk lamp",
];

function StepPills({ active }: { active: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {steps.map((step, i) => {
        const isActive = i === active;
        const isDone = i < active;
        return (
          <div key={step.id} className="flex items-center gap-2 sm:gap-3">
            <motion.div
              layout
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[#007bff]/90 text-white shadow-sm shadow-blue-500/25"
                  : isDone
                    ? "bg-emerald-500/15 text-emerald-800 border border-emerald-200/60"
                    : "bg-white/50 text-gray-500 border border-white/60"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  isActive
                    ? "bg-white/25"
                    : isDone
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-200/80 text-gray-600"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </span>
              {step.label}
            </motion.div>
            {i < steps.length - 1 && (
              <motion.span
                className="hidden sm:block w-6 h-px bg-gray-300"
                animate={{ opacity: isDone ? 1 : 0.35 }}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function UploadScene() {
  return (
    <motion.div
      key="upload"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="flex flex-col items-center justify-center min-h-[280px] sm:min-h-[300px] px-4"
    >
      <motion.div
        className="w-full max-w-sm rounded-2xl border-2 border-dashed border-[#007bff]/40 bg-white/40 backdrop-blur-sm p-8 text-center"
        animate={{
          borderColor: ["rgba(0,123,255,0.35)", "rgba(0,123,255,0.65)", "rgba(0,123,255,0.35)"],
        }}
        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.45, ease: easeOut }}
          className="mx-auto w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 mb-4"
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </motion.div>
        <p className="text-sm font-semibold text-gray-900">Drop your packing list</p>
        <p className="text-xs text-gray-500 mt-1">PDF, Word, or Excel</p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4, ease: easeOut }}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/80 border border-white shadow-sm text-xs font-medium text-gray-800"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
          Packing_List_March.pdf
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function ClassifyScene() {
  const [classified, setClassified] = useState(0);

  useEffect(() => {
    setClassified(0);
    const stepMs = (PHASE_MS - 600) / lineItems.length;
    const timers = lineItems.map((_, i) =>
      setTimeout(() => setClassified(i + 1), 400 + stepMs * i)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      key="classify"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="min-h-[280px] sm:min-h-[300px] px-4 sm:px-6 py-2 flex flex-col"
    >
      <div className="landing-glass-panel rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-sm font-semibold text-gray-900">AI classifying items</p>
          <span className="text-xs font-medium text-[#007bff] tabular-nums">
            {classified}/{lineItems.length}
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/60 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#007bff] to-sky-400"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{
              duration: (PHASE_MS - 600) / 1000,
              ease: "linear",
              delay: 0.2,
            }}
          />
        </div>
        <p className="text-[10px] text-gray-500 mt-2">
          Feature extraction → GRI rules → HS code assignment
        </p>
      </div>
      <ul className="space-y-2 flex-1">
        {lineItems.map((line, i) => {
          const done = i < classified;
          const active = i === classified && classified < lineItems.length;
          return (
            <motion.li
              key={line}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: done || active ? 1 : 0.45, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs ${
                done
                  ? "bg-white/50 border border-white/60"
                  : active
                    ? "bg-blue-50/80 border border-blue-100"
                    : "bg-white/25 border border-transparent"
              }`}
            >
              <span
                className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "border-2 border-[#007bff] border-t-transparent animate-spin"
                      : "bg-gray-200/80"
                }`}
                aria-hidden
              >
                {done && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className={`truncate font-medium ${done ? "text-gray-900" : "text-gray-600"}`}>
                {line}
              </span>
              {done && (
                <span className="ml-auto shrink-0 text-[10px] text-emerald-700 font-medium">
                  Classified
                </span>
              )}
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
}

function ListScene() {
  return (
    <motion.div
      key="list"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="min-h-[280px] sm:min-h-[300px] px-4 sm:px-5 py-2"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Grouped by HS code</p>
          <p className="text-[10px] text-gray-500">Ready to review and export</p>
        </div>
        <motion.span
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-400/25 text-emerald-800 border border-emerald-200/50"
        >
          Completed
        </motion.span>
      </div>
      <div className="landing-glass-panel rounded-xl overflow-hidden">
        <table className="w-full text-left text-[11px] sm:text-xs">
          <thead>
            <tr className="text-gray-600 bg-white/25">
              <th className="px-3 py-2 font-medium">HS code</th>
              <th className="px-3 py-2 font-medium hidden sm:table-cell">Category</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium text-right w-12">Qty</th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.map((row, i) => (
              <motion.tr
                key={row.hs}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.35, ease: easeOut }}
                className="border-t border-white/40"
              >
                <td className="px-3 py-2.5 font-semibold text-[#007bff]">{row.hs}</td>
                <td className="px-3 py-2.5 text-gray-600 hidden sm:table-cell">{row.category}</td>
                <td className="px-3 py-2.5 text-gray-900">{row.desc}</td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums">{row.qty}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65 }}
        className="text-center text-[10px] text-gray-500 mt-3"
      >
        Export to Excel when you are ready
      </motion.p>
    </motion.div>
  );
}

export function DashboardFlowAnimation() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setPhase((p) => (p + 1) % steps.length);
    }, PHASE_MS);
    return () => clearInterval(id);
  }, [reduced]);

  const scenes = [<UploadScene />, <ClassifyScene />, <ListScene />];

  return (
    <div className="space-y-5" aria-live="polite" aria-label="Product workflow preview">
      <StepPills active={phase} />
      <div className="relative min-h-[280px] sm:min-h-[300px]">
        <AnimatePresence mode="wait">
          {reduced ? scenes[2] : scenes[phase]}
        </AnimatePresence>
      </div>
    </div>
  );
}
