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
        className="w-4 h-4 text-white"
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
    <span className="text-xs font-semibold text-gray-400" aria-hidden>
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
        "Building declaration-ready groups and preparing your Excel export.",
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
    <div className="landing-float-card bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm w-full">
      {/* Header */}
      <div className="px-5 py-4 sm:px-6 border-b border-gray-100 bg-gradient-to-br from-slate-50 to-white">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-11 h-11 rounded-xl bg-[#007bff]/10 flex items-center justify-center text-[#007bff]">
            <svg
              aria-hidden
              className="w-6 h-6 animate-pulse"
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
            <p className="text-xs font-semibold uppercase tracking-wider text-[#007bff]">
              Step {activeIndex + 1} of {steps.length}
            </p>
            <h2 className="text-lg font-semibold text-gray-900 mt-0.5 truncate">
              {fileName ?? "Your document"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Processing in progress — please keep this tab open.
            </p>
          </div>
        </div>

        {/* Overall progress */}
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-medium text-gray-600">Overall progress</span>
            <span className="font-semibold text-gray-900 tabular-nums">
              {percent}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden" aria-hidden>
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#007bff] to-[#0069d9] transition-all duration-500 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Horizontal stepper — desktop */}
      <div className="hidden sm:block px-4 sm:px-6 py-5 border-b border-gray-50">
        <ol className="flex items-start justify-between gap-1" aria-label="Processing steps">
          {steps.map((step, i) => (
            <li
              key={step.id}
              className="flex flex-1 flex-col items-center min-w-0 relative"
            >
              {i > 0 && (
                <span
                  className={`absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2 ${
                    step.state === "upcoming" ? "bg-gray-200" : "bg-[#007bff]"
                  }`}
                  style={{ width: "calc(100% - 2rem)", right: "50%" }}
                  aria-hidden
                />
              )}
              <span
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                  step.state === "complete"
                    ? "bg-[#007bff] border-[#007bff]"
                    : step.state === "current"
                      ? "bg-[#007bff] border-[#007bff] ring-4 ring-[#007bff]/15"
                      : "bg-white border-gray-200"
                }`}
              >
                <StepIcon state={step.state} />
              </span>
              <span
                className={`mt-2 text-center text-[11px] leading-tight px-1 ${
                  step.state === "current"
                    ? "font-semibold text-gray-900"
                    : step.state === "complete"
                      ? "font-medium text-gray-600"
                      : "text-gray-400"
                }`}
              >
                {step.title}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Current step detail */}
      {current && (
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <div
            className="rounded-xl border border-[#007bff]/20 bg-blue-50/40 px-4 py-4"
            aria-live="polite"
          >
            <p className="text-sm font-semibold text-gray-900">{current.title}</p>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              {current.description}
            </p>
            {showClassifyMeter && (
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-600">Items classified</span>
                  <span className="font-semibold text-gray-900 tabular-nums">
                    {classified} / {total}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#007bff] transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.round((classified / total) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Vertical step list — mobile */}
          <ol className="sm:hidden mt-5 space-y-0 border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100">
            {steps.map((step, i) => (
              <li
                key={step.id}
                className={`flex items-center gap-3 px-3 py-3 ${
                  step.state === "current" ? "bg-blue-50/50" : "bg-white"
                }`}
              >
                <span
                  className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    step.state === "complete"
                      ? "bg-[#007bff] text-white"
                      : step.state === "current"
                        ? "bg-[#007bff] text-white ring-2 ring-[#007bff]/20"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {step.state === "complete" ? (
                    <svg
                      aria-hidden
                      className="w-3.5 h-3.5"
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
                      ? "font-semibold text-gray-900"
                      : step.state === "complete"
                        ? "text-gray-600"
                        : "text-gray-400"
                  }`}
                >
                  {step.title}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3.5 sm:px-6 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs text-gray-500 leading-relaxed">
          Large lists run in batches. You can safely leave and return — processing
          resumes automatically.
        </p>
        {status === "ai_processed" && !processing && onContinueClassification && (
          <button
            type="button"
            onClick={onContinueClassification}
            className="text-xs font-semibold text-[#007bff] hover:text-[#0069d9] shrink-0"
          >
            Stuck? Continue →
          </button>
        )}
      </div>
    </div>
  );
}
