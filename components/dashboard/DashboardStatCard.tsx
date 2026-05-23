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
  accent?: "default" | "green" | "blue" | "amber" | "red";
  icon: ReactNode;
}) {
  const accents = {
    default: {
      icon: "bg-gray-100 text-gray-600",
      value: "text-gray-900",
    },
    green: {
      icon: "bg-emerald-50 text-emerald-600",
      value: "text-emerald-600",
    },
    blue: {
      icon: "bg-blue-50 text-[#007bff]",
      value: "text-[#007bff]",
    },
    amber: {
      icon: "bg-amber-50 text-amber-600",
      value: "text-amber-600",
    },
    red: {
      icon: "bg-red-50 text-red-600",
      value: "text-red-600",
    },
  };
  const a = accents[accent];

  return (
    <div className="landing-float-card bg-white rounded-2xl p-5 border border-gray-100/80">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className={`mt-1 text-2xl sm:text-3xl font-bold tabular-nums ${a.value}`}>
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-gray-400">{hint}</p>
          ) : null}
        </div>
        <div
          className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${a.icon}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
