"use client";

type ProcessingStatus =
  | "uploaded"
  | "parsed"
  | "ai_processed"
  | "completed"
  | "failed"
  | string;

type StepState = "complete" | "current" | "upcoming";

export type ProcessingStep = {
  id: string;
  title: string;
  description: string;
  state: StepState;
};

function StepIcon({ state }: { state: StepState }) {
  if (state === "complete") {
    return (
      <svg
        aria-hidden
        className="h-4 w-4 text-white"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <title>Complete</title>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M5 13l4 4L19 7"
        />
      </svg>
    );
  }
  if (state === "current") {
    return (
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold text-slate-400" aria-hidden>
      ·
    </span>
  );
}

export function buildProcessingSteps(
  status: ProcessingStatus,
  progress: { totalItems: number; classifiedCount: number } | null,
  isPreCoded: boolean,
): { steps: ProcessingStep[]; activeIndex: number; percent: number } {
  const classified = progress?.classifiedCount ?? 0;
  const total = progress?.totalItems ?? 0;
  const classifyPct =
    total > 0 ? Math.min(100, Math.round((classified / total) * 100)) : 0;

  const statusIndex =
    status === "uploaded"
      ? 0
      : status === "parsed"
        ? 1
        : status === "ai_processed"
          ? 2
          : -1;

  const groupingActive =
    status === "ai_processed" && total > 0 && classified >= total;

  const activeIndex = groupingActive ? 3 : Math.max(0, statusIndex);

  const stepDefs = [
    {
      id: "read",
      title: "Read document",
      description: isPreCoded
        ? "Opening your packing list and detecting HS columns."
        : "Loading your file from secure storage.",
    },
    {
      id: "extract",
      title: "Extract line items",
      description: isPreCoded
        ? "Parsing rows, quantities, and document HS codes."
        : "Pulling descriptions and quantities from tables and text.",
    },
    {
      id: "classify",
      title: isPreCoded ? "Validate & classify" : "AI classification",
      description: isPreCoded
        ? "Matching line items to categories and flagging mismatches."
        : "Assigning HS codes and categories to each line item.",
    },
    {
      id: "group",
      title: "Group by HS code",
      description:
        "Building declaration-ready groups and preparing your export.",
    },
  ];

  const steps: ProcessingStep[] = stepDefs.map((def, i) => {
    let state: StepState = "upcoming";
    if (i < activeIndex) state = "complete";
    else if (i === activeIndex) state = "current";
    return { ...def, state };
  });

  const basePercent = (activeIndex / stepDefs.length) * 100;
  const stepSlice = 100 / stepDefs.length;
  const sub =
    activeIndex === 2 && total > 0
      ? (classifyPct / 100) * stepSlice
      : activeIndex === 3
        ? stepSlice * 0.5
        : stepSlice * 0.35;

  const percent = Math.min(99, Math.round(basePercent + sub));

  return { steps, activeIndex, percent };
}

type DocumentProcessingStepperProps = {
  fileName: string | null;
  status: ProcessingStatus;
  progress: { totalItems: number; classifiedCount: number } | null;
  isPreCoded?: boolean;
  processing?: boolean;
  onContinueClassification?: () => void;
};

export function DocumentProcessingStepper({
  fileName,
  status,
  progress,
  isPreCoded = false,
  processing = false,
  onContinueClassification,
}: DocumentProcessingStepperProps) {
  const { steps, activeIndex, percent } = buildProcessingSteps(
    status,
    progress,
    isPreCoded,
  );
  const current = steps[activeIndex];
  const classified = progress?.classifiedCount ?? 0;
  const total = progress?.totalItems ?? 0;
  const showClassifyMeter =
    current?.id === "classify" && total > 0 && status === "ai_processed";

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)] w-full">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-slate-100 px-5 py-5 sm:px-7 sm:py-6">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/40"
          aria-hidden
        />
        <div className="relative flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/25">
            <svg
              aria-hidden
              className="h-7 w-7 animate-pulse text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>Processing</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">
              Step {activeIndex + 1} of {steps.length}
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 truncate sm:text-2xl">
              {fileName ?? "Your document"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Processing in progress — keep this tab open for live updates.
            </p>
          </div>
        </div>

        <div className="relative mt-5">
          <div className="mb-2 flex justify-between text-xs">
            <span className="font-semibold text-slate-600">Overall progress</span>
            <span className="font-bold tabular-nums text-slate-900">{percent}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 transition-all duration-500 ease-out shadow-sm shadow-indigo-500/30"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Horizontal stepper — desktop */}
      <div className="hidden border-b border-slate-50 px-6 py-5 sm:block">
        <ol className="flex items-start justify-between gap-1" aria-label="Processing steps">
          {steps.map((step, i) => (
            <li
              key={step.id}
              className="relative flex min-w-0 flex-1 flex-col items-center"
            >
              {i > 0 && (
                <span
                  className={`absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2 ${
                    step.state === "upcoming" ? "bg-slate-200" : "bg-indigo-500"
                  }`}
                  style={{ width: "calc(100% - 2rem)", right: "50%" }}
                  aria-hidden
                />
              )}
              <span
                className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                  step.state === "complete"
                    ? "border-indigo-600 bg-indigo-600"
                    : step.state === "current"
                      ? "border-indigo-600 bg-indigo-600 ring-4 ring-indigo-500/20"
                      : "border-slate-200 bg-white"
                }`}
              >
                <StepIcon state={step.state} />
              </span>
              <span
                className={`mt-2 px-1 text-center text-[11px] leading-tight ${
                  step.state === "current"
                    ? "font-bold text-slate-900"
                    : step.state === "complete"
                      ? "font-semibold text-slate-600"
                      : "text-slate-400"
                }`}
              >
                {step.title}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {current && (
        <div className="px-5 py-4 sm:px-7 sm:py-5">
          <div
            className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-violet-50/40 px-4 py-4"
            aria-live="polite"
          >
            <p className="text-sm font-bold text-slate-900">{current.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {current.description}
            </p>
            {showClassifyMeter && (
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="text-slate-600">Items classified</span>
                  <span className="font-bold tabular-nums text-slate-900">
                    {classified} / {total}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/80">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.round((classified / total) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <ol className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 sm:hidden">
            {steps.map((step, i) => (
              <li
                key={step.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  step.state === "current" ? "bg-indigo-50/50" : "bg-white"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    step.state === "complete"
                      ? "bg-indigo-600 text-white"
                      : step.state === "current"
                        ? "bg-indigo-600 text-white ring-2 ring-indigo-500/20"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {step.state === "complete" ? (
                    <svg
                      aria-hidden
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <title>Done</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`text-sm ${
                    step.state === "current"
                      ? "font-bold text-slate-900"
                      : step.state === "complete"
                        ? "text-slate-600"
                        : "text-slate-400"
                  }`}
                >
                  {step.title}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="text-xs leading-relaxed text-slate-500">
          Large lists run in batches. You can leave and return — processing resumes automatically.
        </p>
        {status === "ai_processed" && !processing && onContinueClassification && (
          <button
            type="button"
            onClick={onContinueClassification}
            className="shrink-0 text-xs font-bold text-indigo-600 hover:text-indigo-700"
          >
            Stuck? Continue →
          </button>
        )}
      </div>
    </div>
  );
}
