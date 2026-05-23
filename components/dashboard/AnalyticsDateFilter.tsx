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
    label: "Last 7 days",
    getRange: () => {
      const to = startOfToday();
      const from = new Date(to);
      from.setDate(from.getDate() - 6);
      return { from: toDateKey(from), to: toDateKey(to) };
    },
  },
  {
    id: "30d",
    label: "Last 30 days",
    getRange: () => {
      const to = startOfToday();
      const from = new Date(to);
      from.setDate(from.getDate() - 29);
      return { from: toDateKey(from), to: toDateKey(to) };
    },
  },
  {
    id: "90d",
    label: "Last 90 days",
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
    <div className="landing-float-card bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Date range
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => apply(preset.getRange().from, preset.getRange().to)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activePreset === preset.id
                    ? "bg-[#007bff] text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="block">
            <span className="text-xs font-medium text-gray-500 mb-1 block">From</span>
            <input
              type="date"
              value={draftFrom}
              max={draftTo}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="w-full sm:w-auto py-2 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bff] focus:ring-[3px] focus:ring-[#007bff]/12"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 mb-1 block">To</span>
            <input
              type="date"
              value={draftTo}
              min={draftFrom}
              max={toDateKey(startOfToday())}
              onChange={(e) => setDraftTo(e.target.value)}
              className="w-full sm:w-auto py-2 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bff] focus:ring-[3px] focus:ring-[#007bff]/12"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (draftFrom && draftTo) apply(draftFrom, draftTo);
            }}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors shrink-0"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
