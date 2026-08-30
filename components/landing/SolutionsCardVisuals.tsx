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

export function BrokersVisual() {
  const reduced = useReducedMotion();

  const jobs = [
    { id: "PL-2841", client: "Acme Imports", items: 412 },
    { id: "PL-2842", client: "Global Trade Co", items: 238 },
    { id: "PL-2843", client: "Nordic Freight", items: 156 },
  ];

  return (
    <VisualShell gradient="bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-100">
      <motion.div
        className="w-full max-w-[230px] rounded-xl bg-white/90 backdrop-blur-sm shadow-lg shadow-amber-500/10 border border-white/80 overflow-hidden"
        initial={reduced ? false : { y: 8, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: easeOut }}
      >
        <div className="flex items-center justify-between bg-amber-50/80 px-3 py-2 border-b border-amber-100/80">
          <p className="text-[10px] font-semibold text-amber-900">Broker queue</p>
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[8px] font-bold text-white">
            24 this week
          </span>
        </div>
        <div className="p-2 space-y-1.5">
          {jobs.map((job, i) => (
            <motion.div
              key={job.id}
              className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1.5"
              initial={reduced ? false : { opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.35 }}
            >
              <div className="min-w-0">
                <p className="text-[9px] font-semibold text-gray-800 truncate">{job.id}</p>
                <p className="text-[8px] text-gray-400 truncate">{job.client}</p>
              </div>
              <span className="text-[9px] font-medium text-amber-700 tabular-nums shrink-0">
                {job.items} lines
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        className="absolute right-4 bottom-4 flex -space-x-1.5"
        initial={reduced ? false : { opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.35, duration: 0.4 }}
        aria-hidden
      >
        {["bg-orange-300", "bg-blue-300", "bg-emerald-300", "bg-violet-300"].map((color) => (
          <span
            key={color}
            className={`h-6 w-6 rounded-full border-2 border-white ${color}`}
          />
        ))}
      </motion.div>
    </VisualShell>
  );
}

export function ImportExportVisual() {
  const reduced = useReducedMotion();

  return (
    <VisualShell gradient="bg-gradient-to-br from-sky-100 via-cyan-50 to-blue-100">
      <motion.div
        className="w-full max-w-[230px] rounded-xl bg-white/90 backdrop-blur-sm shadow-lg shadow-sky-500/10 border border-white/80 p-3"
        initial={reduced ? false : { y: 8, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: easeOut }}
      >
        <div className="flex items-center gap-2 mb-3">
          {["Submitted", "Classified", "Cleared"].map((stage, i) => (
            <div key={stage} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold ${
                  i < 3 ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-500"
                }`}
                initial={reduced ? false : { scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 280 }}
              >
                {i < 3 ? "✓" : i + 1}
              </motion.div>
              <p className="text-[7px] font-medium text-gray-500 text-center leading-tight">
                {stage}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-blue-50/80 border border-blue-100/80 p-2.5">
          <div className="flex items-start gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#007bff] text-[8px] font-bold text-white">
              FF
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold text-gray-800">Freight forwarder</p>
              <p className="text-[8px] text-gray-500 mt-0.5 leading-snug">
                HS grouped file received — ready for declaration
              </p>
            </div>
          </div>
          <motion.div
            className="mt-2 flex items-center gap-1.5 rounded-md bg-white px-2 py-1 border border-gray-100"
            initial={reduced ? false : { opacity: 0, y: 4 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.45, duration: 0.35 }}
          >
            <span className="text-[8px]">📎</span>
            <span className="text-[8px] font-medium text-emerald-700">shipment_hs_grouped.xlsx</span>
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        className="absolute left-4 top-4 rounded-full bg-emerald-500 px-2 py-1 shadow-md"
        initial={reduced ? false : { scale: 0.8, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5, type: "spring", stiffness: 260 }}
      >
        <p className="text-[9px] font-bold text-white">Same-day clearance</p>
      </motion.div>
    </VisualShell>
  );
}

export function ComplianceVisual() {
  const reduced = useReducedMotion();

  const entries = [
    { action: "HS classification", user: "M. Chen", time: "2h ago" },
    { action: "Export downloaded", user: "Audit team", time: "1d ago" },
    { action: "Document uploaded", user: "Ops", time: "3d ago" },
  ];

  return (
    <VisualShell gradient="bg-gradient-to-br from-slate-200 via-indigo-50 to-violet-100">
      <motion.div
        className="w-full max-w-[230px] rounded-xl bg-white/90 backdrop-blur-sm shadow-lg shadow-indigo-500/10 border border-white/80 overflow-hidden"
        initial={reduced ? false : { y: 8, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: easeOut }}
      >
        <div className="flex items-center gap-2 bg-indigo-50/80 px-3 py-2 border-b border-indigo-100/80">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-600 text-white">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <title>Audit trail</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <p className="text-[10px] font-semibold text-indigo-900">Audit trail</p>
        </div>
        <div className="p-2 space-y-0">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.action}
              className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0"
              initial={reduced ? false : { opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.35 }}
            >
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-medium text-gray-800">{entry.action}</p>
                <p className="text-[8px] text-gray-400">
                  {entry.user} · {entry.time}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        className="absolute right-4 bottom-4 rounded-lg bg-white/95 px-2 py-1 shadow-md border border-indigo-100"
        initial={reduced ? false : { opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.4, duration: 0.35 }}
      >
        <p className="text-[9px] font-bold text-indigo-700">Full traceability</p>
      </motion.div>
    </VisualShell>
  );
}
