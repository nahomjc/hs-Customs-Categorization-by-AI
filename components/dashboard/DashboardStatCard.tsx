import type { ReactNode } from "react";

export function DashboardStatCard({
  label,
  value,
  hint,
  accent = "default",
  icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: "default" | "green" | "blue" | "amber" | "red" | "violet";
  icon: ReactNode;
}) {
  const accents = {
    default: {
      icon: "bg-slate-100 text-slate-600",
      value: "text-slate-900",
      card: "border-slate-200/70",
    },
    green: {
      icon: "bg-emerald-100 text-emerald-600",
      value: "text-emerald-700",
      card: "border-emerald-100/80",
    },
    blue: {
      icon: "bg-indigo-100 text-indigo-600",
      value: "text-indigo-700",
      card: "border-indigo-100/80",
    },
    violet: {
      icon: "bg-violet-100 text-violet-600",
      value: "text-violet-700",
      card: "border-violet-100/80",
    },
    amber: {
      icon: "bg-amber-100 text-amber-600",
      value: "text-amber-700",
      card: "border-amber-100/80",
    },
    red: {
      icon: "bg-red-100 text-red-600",
      value: "text-red-700",
      card: "border-red-100/80",
    },
  };
  const a = accents[accent];

  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_8px_30px_-10px_rgba(15,23,42,0.1)] ${a.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className={`mt-1.5 text-2xl sm:text-3xl font-bold tabular-nums tracking-tight ${a.value}`}>
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-slate-400">{hint}</p>
          ) : null}
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${a.icon}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
