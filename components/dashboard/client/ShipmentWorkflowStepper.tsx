import {
  TRACKING_PIPELINE,
  TRACKING_STEP_DETAILS,
  getTrackingLabel,
  getTrackingProgressPercent,
  getTrackingStepIndex,
} from "@/lib/tracking/workflow";
import type { TrackingStatus } from "@/lib/tracking/constants";

type ShipmentWorkflowStepperProps = {
  status: string;
  note?: string | null;
  /** compact = card strip; full = detail page workflow */
  variant?: "compact" | "full";
  events?: Array<{
    status: string;
    note: string | null;
    createdAt: Date;
  }>;
};

export function ShipmentWorkflowStepper({
  status,
  note,
  variant = "full",
  events = [],
}: ShipmentWorkflowStepperProps) {
  const currentIndex = getTrackingStepIndex(status);
  const isCancelled = status === "cancelled";
  const percent = getTrackingProgressPercent(status);

  if (variant === "compact") {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-700 truncate">
            {isCancelled ? "Cancelled" : getTrackingLabel(status)}
          </p>
          <p className="text-[11px] font-medium tabular-nums text-slate-400 shrink-0">
            {isCancelled ? "—" : `${percent}%`}
          </p>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isCancelled
                ? "bg-red-400"
                : "bg-gradient-to-r from-[#007bff] to-sky-400"
            }`}
            style={{ width: `${isCancelled ? 100 : percent}%` }}
          />
        </div>
        <ol className="flex items-center gap-1" aria-hidden>
          {TRACKING_PIPELINE.map((step, index) => {
            const done = !isCancelled && currentIndex >= 0 && index <= currentIndex;
            const active = !isCancelled && step === status;
            return (
              <li
                key={step}
                className={`h-1 flex-1 rounded-full ${
                  done
                    ? active
                      ? "bg-[#007bff]"
                      : "bg-emerald-400"
                    : "bg-slate-200"
                }`}
              />
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-sky-50/40 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Workflow progress
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {isCancelled ? "Shipment cancelled" : getTrackingLabel(status)}
            </p>
            {note ? (
              <p className="mt-1 text-sm text-slate-600">{note}</p>
            ) : null}
          </div>
          {!isCancelled ? (
            <p className="text-sm font-semibold tabular-nums text-[#007bff]">
              {percent}% complete
            </p>
          ) : null}
        </div>
        <div className="mt-4 h-2 rounded-full bg-white/80 ring-1 ring-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              isCancelled
                ? "bg-red-400 w-full"
                : "bg-gradient-to-r from-[#007bff] via-sky-400 to-emerald-400"
            }`}
            style={isCancelled ? undefined : { width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Desktop horizontal stepper */}
      <ol className="hidden md:grid grid-cols-6 gap-2">
        {TRACKING_PIPELINE.map((step, index) => {
          const done = !isCancelled && currentIndex >= 0 && index < currentIndex;
          const active = !isCancelled && step === status;
          const upcoming = !done && !active;
          const event = [...events].reverse().find((e) => e.status === step);

          return (
            <li key={step} className="relative min-w-0">
              {index < TRACKING_PIPELINE.length - 1 ? (
                <span
                  className={`absolute left-[calc(50%+14px)] right-[-50%] top-[15px] h-0.5 ${
                    done || active ? "bg-emerald-300" : "bg-slate-200"
                  }`}
                  aria-hidden
                />
              ) : null}
              <div className="relative flex flex-col items-center text-center px-1">
                <span
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : active
                        ? "border-[#007bff] bg-[#007bff] text-white shadow-md shadow-blue-500/25"
                        : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {done ? "✓" : index + 1}
                </span>
                <p
                  className={`mt-2.5 text-[11px] font-semibold leading-snug ${
                    active
                      ? "text-[#007bff]"
                      : done
                        ? "text-slate-800"
                        : "text-slate-400"
                  }`}
                >
                  {getTrackingLabel(step)}
                </p>
                <p
                  className={`mt-1 text-[10px] leading-snug ${
                    upcoming ? "text-slate-300" : "text-slate-500"
                  }`}
                >
                  {TRACKING_STEP_DETAILS[step as Exclude<TrackingStatus, "cancelled">]}
                </p>
                {event ? (
                  <p className="mt-1.5 text-[10px] text-slate-400">
                    {event.createdAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Mobile vertical stepper */}
      <ol className="md:hidden space-y-0 px-1">
        {TRACKING_PIPELINE.map((step, index) => {
          const done = !isCancelled && currentIndex >= 0 && index < currentIndex;
          const active = !isCancelled && step === status;
          const event = [...events].reverse().find((e) => e.status === step);
          const isLast = index === TRACKING_PIPELINE.length - 1;

          return (
            <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
              {!isLast ? (
                <span
                  className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${
                    done ? "bg-emerald-300" : "bg-slate-200"
                  }`}
                  aria-hidden
                />
              ) : null}
              <span
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : active
                      ? "border-[#007bff] bg-[#007bff] text-white"
                      : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              <div className="min-w-0 pt-1">
                <p
                  className={`text-sm font-semibold ${
                    active
                      ? "text-[#007bff]"
                      : done
                        ? "text-slate-800"
                        : "text-slate-400"
                  }`}
                >
                  {getTrackingLabel(step)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {TRACKING_STEP_DETAILS[step as Exclude<TrackingStatus, "cancelled">]}
                </p>
                {event?.note ? (
                  <p className="mt-1 text-xs text-slate-600">{event.note}</p>
                ) : null}
                {event ? (
                  <p className="mt-1 text-[11px] text-slate-400">
                    {event.createdAt.toLocaleString()}
                  </p>
                ) : null}
                {active ? (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-[#007bff]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#007bff] animate-pulse" />
                    Current stage
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
