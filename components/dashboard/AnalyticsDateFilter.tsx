"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toDateKey } from "@/lib/dashboard-analytics-utils";

type Preset = {
  id: string;
  label: string;
  getRange: () => { from: string; to: string };
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const PRESETS: Preset[] = [
  {
    id: "7d",
    label: "7 days",
    getRange: () => {
      const to = startOfToday();
      const from = new Date(to);
      from.setDate(from.getDate() - 6);
      return { from: toDateKey(from), to: toDateKey(to) };
    },
  },
  {
    id: "30d",
    label: "30 days",
    getRange: () => {
      const to = startOfToday();
      const from = new Date(to);
      from.setDate(from.getDate() - 29);
      return { from: toDateKey(from), to: toDateKey(to) };
    },
  },
  {
    id: "90d",
    label: "90 days",
    getRange: () => {
      const to = startOfToday();
      const from = new Date(to);
      from.setDate(from.getDate() - 89);
      return { from: toDateKey(from), to: toDateKey(to) };
    },
  },
  {
    id: "month",
    label: "This month",
    getRange: () => {
      const to = startOfToday();
      const from = new Date(to.getFullYear(), to.getMonth(), 1);
      return { from: toDateKey(from), to: toDateKey(to) };
    },
  },
  {
    id: "last-month",
    label: "Last month",
    getRange: () => {
      const to = new Date(startOfToday().getFullYear(), startOfToday().getMonth(), 0);
      const from = new Date(to.getFullYear(), to.getMonth(), 1);
      return { from: toDateKey(from), to: toDateKey(to) };
    },
  },
];

export function AnalyticsDateFilter({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
  }, [from, to]);

  const apply = useCallback(
    (fromVal: string, toVal: string) => {
      setDraftFrom(fromVal);
      setDraftTo(toVal);
      const params = new URLSearchParams();
      params.set("from", fromVal);
      params.set("to", toVal);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router],
  );

  const activePreset = PRESETS.find((p) => {
    const r = p.getRange();
    return r.from === from && r.to === to;
  })?.id;

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Quick ranges
          </p>
          <div className="flex flex-wrap gap-1.5 rounded-2xl bg-slate-100/80 p-1">
            {PRESETS.map((preset) => {
              const isActive = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => apply(preset.getRange().from, preset.getRange().to)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm shadow-slate-200/80"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              From
            </span>
            <input
              type="date"
              value={draftFrom}
              max={draftTo}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-indigo-500/15 sm:w-auto"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              To
            </span>
            <input
              type="date"
              value={draftTo}
              min={draftFrom}
              max={toDateKey(startOfToday())}
              onChange={(e) => setDraftTo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-indigo-500/15 sm:w-auto"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (draftFrom && draftTo) apply(draftFrom, draftTo);
            }}
            className="shrink-0 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:shadow-lg hover:shadow-indigo-500/25"
          >
            Apply range
          </button>
        </div>
      </div>
    </div>
  );
}
