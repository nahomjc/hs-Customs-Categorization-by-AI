"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { easeOut } from "./motion";

function VisualShell({
  children,
  gradient,
}: {
  children: ReactNode;
  gradient: string;
}) {
  return (
    <div
      className={`relative h-44 sm:h-48 overflow-hidden rounded-t-2xl ${gradient}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.35) 1px, transparent 0)",
          backgroundSize: "18px 18px",
        }}
        aria-hidden="true"
      />
      <div className="relative h-full flex items-center justify-center p-5">
        {children}
      </div>
    </div>
  );
}

export function UploadStepVisual() {
  const reduced = useReducedMotion();

  return (
    <VisualShell gradient="bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100">
      <motion.div
        className="w-full max-w-[220px] rounded-xl bg-white/90 backdrop-blur-sm shadow-lg shadow-blue-500/10 border border-white/80 p-4"
        initial={reduced ? false : { y: 8, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: easeOut }}
      >
        <div className="rounded-lg border-2 border-dashed border-[#007bff]/35 bg-blue-50/50 px-3 py-5 text-center">
          <motion.div
            className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#007bff] text-white shadow-md shadow-blue-500/30"
            animate={
              reduced
                ? undefined
                : { y: [0, -4, 0], scale: [1, 1.04, 1] }
            }
            transition={{
              duration: 2.4,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <title>Upload</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </motion.div>
          <p className="text-[10px] font-semibold text-gray-700">Drop packing list</p>
          <p className="text-[9px] text-gray-400 mt-0.5">PDF · Word · Excel</p>
        </div>
        <div className="mt-3 flex gap-1.5 justify-center">
          {[
            { label: "PDF", color: "bg-red-100 text-red-600" },
            { label: "XLS", color: "bg-emerald-100 text-emerald-700" },
            { label: "DOC", color: "bg-blue-100 text-blue-700" },
          ].map((fmt, i) => (
            <motion.span
              key={fmt.label}
              className={`rounded-md px-2 py-0.5 text-[8px] font-bold ${fmt.color}`}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
            >
              {fmt.label}
            </motion.span>
          ))}
        </div>
      </motion.div>

      <motion.div
        className="absolute right-5 top-5 rounded-lg bg-white/95 px-2 py-1.5 shadow-md border border-white"
        initial={reduced ? false : { opacity: 0, x: 10 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3, duration: 0.4, ease: easeOut }}
      >
        <p className="text-[9px] font-semibold text-gray-800">847 lines parsed</p>
      </motion.div>
    </VisualShell>
  );
}

export function ClassifyStepVisual() {
  const reduced = useReducedMotion();

  const rows = [
    { item: "Floor lamp", hs: "9405", done: true },
    { item: "Cafe chair", hs: "9401", done: true },
    { item: "Ceiling fan", hs: "—", done: false },
  ];

  return (
    <VisualShell gradient="bg-gradient-to-br from-violet-100 via-indigo-50 to-blue-100">
      <motion.div
        className="w-full max-w-[230px] rounded-xl bg-white/90 backdrop-blur-sm shadow-lg shadow-indigo-500/10 border border-white/80 overflow-hidden"
        initial={reduced ? false : { y: 8, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: easeOut }}
      >
        <div className="flex items-center justify-between bg-indigo-50/80 px-3 py-2 border-b border-indigo-100/80">
          <p className="text-[10px] font-semibold text-indigo-900">AI classification</p>
          <motion.span
            className="flex items-center gap-1 rounded-full bg-[#007bff] px-2 py-0.5 text-[8px] font-semibold text-white"
            animate={reduced ? undefined : { opacity: [1, 0.7, 1] }}
            transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY }}
          >
            <span className="h-1 w-1 rounded-full bg-white" />
            Live
          </motion.span>
        </div>
        <div className="p-2.5 space-y-1.5">
          {rows.map((row, i) => (
            <motion.div
              key={row.item}
              className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1.5"
              initial={reduced ? false : { opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.35 }}
            >
              <span className="text-[9px] text-gray-600 truncate max-w-[90px]">{row.item}</span>
              <span
                className={`text-[9px] font-bold tabular-nums ${
                  row.done ? "text-[#007bff]" : "text-gray-300"
                }`}
              >
                {row.hs}
              </span>
            </motion.div>
          ))}
        </div>
        <div className="px-3 pb-2.5">
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#007bff] to-indigo-500"
              initial={{ width: 0 }}
              whileInView={{ width: "72%" }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 1, ease: easeOut }}
            />
          </div>
        </div>
      </motion.div>

      <motion.div
        className="absolute left-4 bottom-4 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md text-lg"
        animate={reduced ? undefined : { rotate: [0, 8, -8, 0] }}
        transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        aria-hidden
      >
        ✨
      </motion.div>
    </VisualShell>
  );
}

export function ExportStepVisual() {
  const reduced = useReducedMotion();

  return (
    <VisualShell gradient="bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100">
      <motion.div
        className="w-full max-w-[230px] rounded-xl bg-white/90 backdrop-blur-sm shadow-lg shadow-emerald-500/10 border border-white/80 overflow-hidden"
        initial={reduced ? false : { y: 8, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: easeOut }}
      >
        <div className="flex items-center gap-2 bg-emerald-50/80 px-3 py-2 border-b border-emerald-100/80">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-600 text-[8px] font-bold text-white">
            X
          </div>
          <p className="text-[10px] font-semibold text-emerald-900">grouped_export.xlsx</p>
        </div>
        <div className="p-2">
          <div className="grid grid-cols-3 gap-px bg-gray-200 rounded overflow-hidden text-[8px]">
            <div className="bg-gray-100 px-1.5 py-1 font-semibold text-gray-600">HS</div>
            <div className="bg-gray-100 px-1.5 py-1 font-semibold text-gray-600">Item</div>
            <div className="bg-gray-100 px-1.5 py-1 font-semibold text-gray-600">Qty</div>
            {[
              ["9405", "Lamp", "12"],
              ["9401", "Chair", "48"],
              ["8414", "Fan", "24"],
            ].map(([hs, item, qty], i) => (
              <motion.div
                key={hs}
                className="contents"
                initial={reduced ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 + i * 0.08 }}
              >
                <div className="bg-white px-1.5 py-1 font-medium text-[#007bff]">{hs}</div>
                <div className="bg-white px-1.5 py-1 text-gray-600 truncate">{item}</div>
                <div className="bg-white px-1.5 py-1 text-gray-600">{qty}</div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="px-3 pb-3">
          <motion.div
            className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-1.5 text-[9px] font-semibold text-white shadow-sm"
            whileHover={{ scale: 1.02 }}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <title>Download</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download ready
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        className="absolute right-4 top-4 rounded-full bg-white px-2 py-1 shadow-md border border-emerald-100"
        initial={reduced ? false : { scale: 0.8, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 18 }}
      >
        <p className="text-[9px] font-bold text-emerald-700">✓ Audit-ready</p>
      </motion.div>
    </VisualShell>
  );
}
