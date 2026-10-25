import { BentoCard, BentoCardHeader } from "@/components/dashboard/bento/BentoCard";

export type StepperStepStatus = "complete" | "current" | "upcoming" | "locked";

export type StepperStep = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  status: StepperStepStatus;
  /** Real progress text for the step (e.g. "3/5 reviewed"), when it has any. */
  badge: string | null;
};

const STATUS_TEXT: Record<StepperStepStatus, string> = {
  complete: "completed",
  current: "current step",
  upcoming: "not started",
  locked: "locked",
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007bff]/45 focus-visible:ring-offset-2";

function CheckGlyph() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.75}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}

function ChevronGlyph() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

function StepDot({
  status,
  index,
  interactive,
}: {
  status: StepperStepStatus;
  index: number;
  interactive?: boolean;
}) {
  const motion = interactive
    ? "transition-all duration-200 ease-out group-hover:scale-105 group-active:scale-95"
    : "";

  let tone =
    "border-2 border-slate-200 bg-white text-slate-600 shadow-sm shadow-slate-200/50";
  let hover = "";

  if (status === "complete") {
    tone =
      "border-0 bg-emerald-500 text-white shadow-md shadow-emerald-500/25";
    hover = interactive
      ? "group-hover:bg-emerald-600 group-hover:shadow-lg group-hover:shadow-emerald-500/35 group-hover:ring-2 group-hover:ring-emerald-200"
      : "";
  } else if (status === "current") {
    tone =
      "border-0 bg-[#007bff] text-white shadow-md shadow-[#007bff]/30 ring-4 ring-blue-100";
    hover = interactive
      ? "group-hover:bg-[#0069d9] group-hover:ring-[5px] group-hover:ring-blue-100/90 group-hover:shadow-lg group-hover:shadow-blue-500/25"
      : "";
  } else if (status === "locked") {
    tone =
      "border border-dashed border-slate-200 bg-slate-50 text-slate-300 shadow-none";
  } else if (interactive) {
    hover =
      "group-hover:border-[#007bff] group-hover:bg-blue-50 group-hover:text-[#007bff] group-hover:shadow-md group-hover:shadow-blue-500/15";
  }

  return (
    <span
      aria-hidden="true"
      className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${tone} ${motion} ${hover}`}
    >
      {status === "complete" ? (
        <CheckGlyph />
      ) : status === "locked" ? (
        <LockGlyph />
      ) : (
        index + 1
      )}
    </span>
  );
}

function labelClass(status: StepperStepStatus, interactive: boolean): string {
  const hover = interactive
    ? "transition-colors duration-200 group-hover:text-[#007bff]"
    : "";
  if (status === "current") {
    return `text-slate-900 ${interactive ? "group-hover:text-slate-900" : ""}`;
  }
  if (status === "complete") {
    return `text-slate-700 ${hover}`;
  }
  if (status === "locked") {
    return "text-slate-300";
  }
  return `text-slate-500 ${hover}`;
}

function stepButtonClass(
  status: StepperStepStatus,
  locked: boolean,
  layout: "horizontal" | "vertical",
): string {
  const layoutClass =
    layout === "horizontal"
      ? "flex-col items-center gap-2 px-2 py-3 text-center"
      : "items-start gap-3 px-3 py-2.5 text-left";

  if (locked) {
    return `group relative z-10 flex w-full ${layoutClass} cursor-not-allowed ${focusRing}`;
  }

  return `group relative z-10 flex w-full ${layoutClass} cursor-pointer bg-transparent ${focusRing}`;
}

/**
 * Bento workflow stepper: horizontal circles + connectors from md up, a
 * vertical list on small screens. Presentational only: selecting a step
 * calls `onSelect`; locking/unlocking rules stay with the caller.
 */
export function CaseWorkflowStepper({
  steps,
  completedCount,
  nextLabel,
  onSelect,
}: {
  steps: StepperStep[];
  completedCount: number;
  nextLabel: string | null;
  onSelect: (id: string) => void;
}) {
  const total = Math.max(steps.length, 1);
  const pct = Math.round((completedCount / total) * 100);

  return (
    <BentoCard label="Workflow steps">
      <BentoCardHeader
        title="Workflow"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {nextLabel ? (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#007bff]">
                Up next: {nextLabel}
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600">
              {completedCount}/{steps.length} complete
            </span>
          </div>
        }
      />

      <div
        className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label="Workflow steps completed"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={completedCount}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#007bff] to-[#0069d9] transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <nav aria-label="Workflow steps">
        {/* Horizontal stepper (md and up) */}
        <ol className="hidden list-none md:flex">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const locked = step.status === "locked";
            const interactive = !locked;
            return (
              <li key={step.id} className="relative min-w-0 flex-1">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onSelect(step.id)}
                  aria-current={step.status === "current" ? "step" : undefined}
                  aria-label={
                    locked
                      ? `${step.label}, locked until previous steps are finished`
                      : step.badge
                        ? `${step.label}, ${step.badge}`
                        : step.label
                  }
                  className={stepButtonClass(step.status, locked, "horizontal")}
                >
                  <div className="relative flex h-9 w-full items-center justify-center">
                    {!isLast ? (
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute left-1/2 top-1/2 z-0 h-0.5 w-full -translate-y-1/2 ${
                          step.status === "complete"
                            ? "bg-emerald-400"
                            : "bg-slate-200"
                        }`}
                      />
                    ) : null}
                    <StepDot
                      status={step.status}
                      index={index}
                      interactive={interactive}
                    />
                  </div>
                  <span
                    className={`text-[11px] font-semibold leading-tight lg:text-xs ${labelClass(step.status, interactive)}`}
                  >
                    {step.label}
                    <span className="sr-only"> ({STATUS_TEXT[step.status]})</span>
                  </span>
                  {step.badge ? (
                    <span
                      className={`text-[10px] font-medium leading-tight tabular-nums transition-colors duration-200 ${
                        locked
                          ? "text-slate-300"
                          : "text-slate-400 group-hover:text-slate-500"
                      }`}
                    >
                      {step.badge}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>

        {/* Vertical stepper (below md) */}
        <ol className="list-none space-y-1 md:hidden">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const locked = step.status === "locked";
            const interactive = !locked;
            return (
              <li key={step.id} className="relative">
                {!isLast ? (
                  <span
                    aria-hidden="true"
                    className={`absolute bottom-[-0.25rem] left-[1.125rem] top-11 w-0.5 -translate-x-1/2 ${
                      step.status === "complete" ? "bg-emerald-400" : "bg-slate-200"
                    }`}
                  />
                ) : null}
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onSelect(step.id)}
                  aria-current={step.status === "current" ? "step" : undefined}
                  aria-label={
                    locked
                      ? `${step.label}, locked until previous steps are finished`
                      : step.badge
                        ? `${step.label}, ${step.badge}`
                        : step.label
                  }
                  className={stepButtonClass(step.status, locked, "vertical")}
                >
                  <StepDot
                    status={step.status}
                    index={index}
                    interactive={interactive}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-semibold ${labelClass(step.status, interactive)}`}
                    >
                      {step.label}
                      <span className="sr-only"> ({STATUS_TEXT[step.status]})</span>
                    </span>
                    <span
                      className={`block text-xs transition-colors duration-200 ${
                        locked
                          ? "text-slate-300"
                          : "text-slate-500 group-hover:text-slate-600"
                      }`}
                    >
                      {step.badge ?? step.description}
                    </span>
                  </span>
                  {interactive ? (
                    <span
                      className="mt-0.5 text-slate-300 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#007bff] group-hover:opacity-100"
                      aria-hidden
                    >
                      <ChevronGlyph />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </BentoCard>
  );
}
