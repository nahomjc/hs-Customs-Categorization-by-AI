"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { easeOut } from "./motion";

function TrafficLights() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
    </div>
  );
}

function BrowserChrome({
  title,
  children,
  sidebar,
}: {
  title: string;
  children: ReactNode;
  sidebar?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_20px_50px_-20px_rgba(15,23,42,0.25)] ring-1 ring-black/[0.03]">
      <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/90 px-4 py-2.5">
        <TrafficLights />
        <div className="flex-1 truncate rounded-md bg-white px-3 py-1 text-[11px] font-medium text-gray-500 border border-gray-100">
          {title}
        </div>
      </div>
      <div className="flex min-h-[300px] sm:min-h-[340px] lg:min-h-[380px]">
        {sidebar ? (
          <aside className="hidden sm:flex w-[132px] shrink-0 flex-col gap-0.5 border-r border-gray-100 bg-gray-50/60 p-2.5">
            {sidebar}
          </aside>
        ) : null}
        <div className="min-w-0 flex-1 p-3 sm:p-4">{children}</div>
      </div>
    </div>
  );
}

function SidebarItem({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-2.5 py-1.5 text-[10px] font-medium ${
        active
          ? "bg-white text-[#007bff] shadow-sm border border-gray-100"
          : "text-gray-500"
      }`}
    >
      {label}
    </div>
  );
}

export function UploadDemoVisual() {
  const reduced = useReducedMotion();

  return (
    <BrowserChrome
      title="app.impactlogistics · Upload"
      sidebar={
        <>
          <SidebarItem label="Upload" active />
          <SidebarItem label="Documents" />
          <SidebarItem label="History" />
        </>
      }
    >
      <motion.div
        className="flex h-full flex-col"
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">New packing list</p>
            <p className="text-[11px] text-gray-400">PDF · Word · Excel</p>
          </div>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#007bff]">
            Ready
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#007bff]/30 bg-gradient-to-br from-sky-50/80 via-white to-blue-50/50 px-4 py-8 text-center">
          <motion.div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#007bff] text-white shadow-lg shadow-blue-500/30"
            animate={
              reduced ? undefined : { y: [0, -5, 0], scale: [1, 1.04, 1] }
            }
            transition={{
              duration: 2.4,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <title>Upload</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </motion.div>
          <p className="text-sm font-semibold text-gray-800">Drop packing list</p>
          <p className="mt-1 text-[11px] text-gray-400">or click to browse files</p>
          <div className="mt-4 flex gap-2">
            {["PDF", "XLS", "DOC"].map((fmt) => (
              <span
                key={fmt}
                className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-gray-600 shadow-sm border border-gray-100"
              >
                {fmt}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 border border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-100 text-[9px] font-bold text-red-600">
              PDF
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-gray-800">
                packing_list_sept.pdf
              </p>
              <p className="text-[10px] text-gray-400">847 lines · 2.4 MB</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-emerald-600">Parsed</span>
        </div>
      </motion.div>
    </BrowserChrome>
  );
}

export function ClassifyDemoVisual() {
  const reduced = useReducedMotion();

  const rows = [
    { item: "Floor standing lamp", hs: "9405.20", done: true },
    { item: "Cafe chair — walnut", hs: "9401.61", done: true },
    { item: "Ceiling fan 52in", hs: "8414.51", done: true },
    { item: "Ceramic vase set", hs: "—", done: false },
    { item: "LED desk lamp", hs: "—", done: false },
  ];

  return (
    <BrowserChrome
      title="app.impactlogistics · Classification"
      sidebar={
        <>
          <SidebarItem label="Upload" />
          <SidebarItem label="Classify" active />
          <SidebarItem label="Review" />
          <SidebarItem label="Export" />
        </>
      }
    >
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">AI classification</p>
            <p className="text-[11px] text-gray-400">Assessor-style HS mapping</p>
          </div>
          <motion.span
            className="flex items-center gap-1.5 rounded-full bg-[#007bff] px-2.5 py-1 text-[10px] font-semibold text-white"
            animate={reduced ? undefined : { opacity: [1, 0.75, 1] }}
            transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Live
          </motion.span>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100">
          <div className="grid grid-cols-[1fr_88px] gap-px bg-gray-100 text-[10px] font-semibold text-gray-500">
            <div className="bg-gray-50 px-3 py-2">Line item</div>
            <div className="bg-gray-50 px-3 py-2">HS code</div>
          </div>
          {rows.map((row, i) => (
            <motion.div
              key={row.item}
              className="grid grid-cols-[1fr_88px] gap-px bg-gray-100"
              initial={reduced ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.3 }}
            >
              <div className="bg-white px-3 py-2 text-[11px] text-gray-700 truncate">
                {row.item}
              </div>
              <div
                className={`bg-white px-3 py-2 text-[11px] font-bold tabular-nums ${
                  row.done ? "text-[#007bff]" : "text-gray-300"
                }`}
              >
                {row.hs}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="font-medium text-gray-500">Progress</span>
            <span className="font-semibold text-gray-700">72%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#007bff] to-indigo-500"
              initial={{ width: 0 }}
              animate={{ width: "72%" }}
              transition={{ delay: 0.2, duration: reduced ? 0 : 0.9, ease: easeOut }}
            />
          </div>
        </div>
      </motion.div>
    </BrowserChrome>
  );
}

export function ReviewDemoVisual() {
  const reduced = useReducedMotion();

  const groups = [
    { hs: "9405", label: "Lamps & lighting", count: 36, status: "Verified" },
    { hs: "9401", label: "Seats & chairs", count: 48, status: "Verified" },
    { hs: "8414", label: "Fans & ventilators", count: 24, status: "Review" },
  ];

  return (
    <BrowserChrome
      title="app.impactlogistics · Review"
      sidebar={
        <>
          <SidebarItem label="Upload" />
          <SidebarItem label="Classify" />
          <SidebarItem label="Review" active />
          <SidebarItem label="Chat" />
        </>
      }
    >
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut }}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">HS groups</p>
            <p className="text-[11px] text-gray-400">packing_list_sept.pdf</p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-gray-900 px-2.5 py-1.5 text-[10px] font-semibold text-white"
            tabIndex={-1}
          >
            Ask about edge cases
          </button>
        </div>

        <div className="space-y-2">
          {groups.map((group, i) => (
            <motion.div
              key={group.hs}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm"
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.3 }}
            >
              <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50">
                <span className="text-[10px] font-bold text-[#007bff]">{group.hs}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-gray-800">
                  {group.label}
                </p>
                <p className="text-[10px] text-gray-400">{group.count} line items</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                  group.status === "Verified"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {group.status}
              </span>
            </motion.div>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5">
          <p className="text-[10px] font-semibold text-[#007bff] mb-1">Chat suggestion</p>
          <p className="text-[11px] text-gray-600 leading-relaxed">
            Fan blades may need a separate heading — confirm motor type before export.
          </p>
        </div>
      </motion.div>
    </BrowserChrome>
  );
}

export function ExportDemoVisual() {
  const reduced = useReducedMotion();

  return (
    <BrowserChrome
      title="app.impactlogistics · Export"
      sidebar={
        <>
          <SidebarItem label="Review" />
          <SidebarItem label="Export" active />
          <SidebarItem label="History" />
        </>
      }
    >
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut }}
        className="flex h-full flex-col"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Grouped export</p>
            <p className="text-[11px] text-gray-400">Declaration-ready spreadsheet</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            ✓ Audit-ready
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100 flex-1">
          <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/80 px-3 py-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-[9px] font-bold text-white">
              X
            </div>
            <p className="text-[11px] font-semibold text-emerald-900">
              grouped_export.xlsx
            </p>
          </div>
          <div className="grid grid-cols-3 gap-px bg-gray-200 text-[10px]">
            <div className="bg-gray-50 px-2.5 py-1.5 font-semibold text-gray-500">HS</div>
            <div className="bg-gray-50 px-2.5 py-1.5 font-semibold text-gray-500">Item</div>
            <div className="bg-gray-50 px-2.5 py-1.5 font-semibold text-gray-500">Qty</div>
            {[
              ["9405", "Lamp", "12"],
              ["9401", "Chair", "48"],
              ["8414", "Fan", "24"],
              ["7013", "Vase", "18"],
            ].map(([hs, item, qty], i) => (
              <motion.div
                key={hs}
                className="contents"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.06 }}
              >
                <div className="bg-white px-2.5 py-1.5 font-semibold text-[#007bff]">{hs}</div>
                <div className="bg-white px-2.5 py-1.5 text-gray-600">{item}</div>
                <div className="bg-white px-2.5 py-1.5 text-gray-600">{qty}</div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/25"
          whileHover={reduced ? undefined : { scale: 1.01 }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <title>Download</title>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download ready
        </motion.div>
      </motion.div>
    </BrowserChrome>
  );
}
