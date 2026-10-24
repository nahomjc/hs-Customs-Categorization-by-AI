"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DashButton } from "@/components/dashboard/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatDuration,
  percentOf,
  type JobFailure,
  type JobStatus,
} from "@/lib/import-cases/job-progress";

/**
 * Generic, flat progress dialog for client-driven batch jobs. A job type
 * (harmonization, classification) supplies a `JobView` built from its snapshot
 * plus a `JobCopy` with its wording; everything else is shared.
 */

export type BarModel =
  | { kind: "indeterminate" }
  | {
      kind: "determinate";
      processed: number;
      total: number;
      verb: string;
      /** What is being counted; defaults to "products". */
      noun?: string;
    };

export type JobTile = { label: string; value: number; tone?: string };

export type JobFailureList = {
  title: string;
  hint: string;
  items: JobFailure[];
  prefix: string;
};

export type JobView = {
  status: JobStatus;
  stageKey: string;
  stageLabel: string;
  stages: { key: string; label: string }[];
  stageIndex: number;
  bar: BarModel;
  tiles: JobTile[];
  failureLists: JobFailureList[];
  /** Green box shown on success. */
  summaryText: string | null;
  fatalError: string | null;
  elapsedMs: number;
  etaMs: number | null;
  /** The current stage processes items, so "estimating..." makes sense. */
  estimating: boolean;
  /** Any failed item (used to choose "Retry failed" vs "Try again"). */
  hasFailures: boolean;
  /** Extra button on success when some secondary work failed. */
  successRetryLabel: string | null;
};

export type JobCopy = {
  ariaLabel: string;
  titles: Record<JobStatus, string>;
  description: string;
  runningNote: string;
  stoppedNote: string;
};

export const isActiveStatus = (status: JobStatus) =>
  status === "running" || status === "stopping";

/** Ticks once a second while `enabled`, so elapsed time and ETA stay live. */
export function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return now;
}

function statusTone(status: JobStatus): string {
  switch (status) {
    case "success":
      return "text-emerald-700";
    case "partial":
    case "stopped":
    case "stopping":
      return "text-amber-700";
    case "failed":
      return "text-red-700";
    default:
      return "text-[#007bff]";
  }
}

function StatTile({ label, value, tone = "text-slate-900" }: JobTile) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function FailureList({ title, hint, items, prefix }: JobFailureList) {
  return (
    <div className="rounded-2xl border border-red-200 bg-white">
      <div className="border-b border-red-100 px-4 py-2">
        <p className="text-sm font-semibold text-red-800">{title}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <ul className="max-h-40 overflow-y-auto px-4 py-2 text-xs text-slate-700">
        {items.map((item) => (
          <li key={item.sequence} className="py-1">
            <span className="font-semibold">
              {prefix} #{item.sequence}
            </span>
            : {item.error}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Dialog body. Pure: renders from a view, so it can be smoke-tested. */
export function JobProgressContent({
  view,
  copy,
}: {
  view: JobView;
  copy: JobCopy;
}) {
  const { bar: model } = view;
  const active = isActiveStatus(view.status);
  const percent =
    model.kind === "determinate" ? percentOf(model.processed, model.total) : 0;
  const countText =
    model.kind === "determinate" && model.total > 0
      ? `${model.processed} of ${model.total} ${model.noun ?? "products"} ${model.verb}`
      : active
        ? `${view.stageLabel}...`
        : "";
  const liveText = [
    view.stageLabel,
    countText && model.kind === "determinate" ? `${countText} (${percent}%)` : "",
    view.status === "success" ? "Finished" : "",
  ]
    .filter(Boolean)
    .join(". ");
  const barColor =
    view.status === "failed"
      ? "bg-red-500"
      : view.status === "success"
        ? "bg-emerald-500"
        : view.status === "partial" || view.status === "stopped"
          ? "bg-amber-500"
          : "bg-[#007bff]";

  return (
    <div className="space-y-5">
      {/* announced to screen readers whenever a batch finishes */}
      <p role="status" aria-live="polite" className="sr-only">
        {liveText}
      </p>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className={`text-sm font-semibold ${statusTone(view.status)}`}>
            {active ? view.stageLabel : copy.titles[view.status]}
          </p>
          {model.kind === "determinate" ? (
            <p className="text-sm font-bold tabular-nums text-slate-900">
              {percent}%
            </p>
          ) : null}
        </div>
        {model.kind === "determinate" ? (
          <div
            role="progressbar"
            aria-label={copy.ariaLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={countText || `${percent}%`}
            className="h-3 w-full overflow-hidden rounded-full bg-slate-100"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${barColor}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        ) : (
          <div
            role="progressbar"
            aria-label={copy.ariaLabel}
            aria-valuetext={`${view.stageLabel} in progress`}
            className="h-3 w-full overflow-hidden rounded-full bg-slate-100"
          >
            <div className="h-full w-1/3 animate-pulse rounded-full bg-[#007bff]" />
          </div>
        )}
        <p className="mt-2 min-h-5 text-sm text-slate-600">{countText}</p>
      </div>

      <ol
        aria-label="Stages"
        className={`grid grid-cols-2 gap-2 ${
          view.stages.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"
        }`}
      >
        {view.stages.map((stage, index) => {
          const done = view.status === "success" || index < view.stageIndex;
          const current = !done && index === view.stageIndex;
          return (
            <li
              key={stage.key}
              aria-current={current ? "step" : undefined}
              className={`rounded-xl border px-3 py-2 text-xs ${
                done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : current
                    ? "border-[#007bff]/40 bg-blue-50 text-[#0069d9]"
                    : "border-slate-200/70 bg-white text-slate-400"
              }`}
            >
              <span className="block font-semibold">
                {done ? "Done" : current ? "Now" : "Next"}
              </span>
              <span className="mt-0.5 block leading-snug">{stage.label}</span>
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {view.tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </div>

      <p className="text-sm text-slate-600">
        <span className="font-medium text-slate-800">
          Elapsed {formatDuration(view.elapsedMs)}
        </span>
        {view.status === "running" ? (
          <>
            {" \u00b7 "}
            {view.etaMs !== null
              ? `about ${formatDuration(view.etaMs)} left in this stage`
              : view.estimating
                ? "estimating time left..."
                : null}
          </>
        ) : null}
      </p>

      {view.status === "success" && view.summaryText ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {view.summaryText}
        </div>
      ) : null}

      {view.fatalError ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {view.fatalError}
        </div>
      ) : null}

      {view.failureLists.map((list) => (
        <FailureList key={list.title} {...list} />
      ))}

      {view.status === "running" ? (
        <p className="text-xs text-slate-500">{copy.runningNote}</p>
      ) : null}
      {view.status === "stopped" ? (
        <p className="text-xs text-slate-500">{copy.stoppedNote}</p>
      ) : null}
    </div>
  );
}

type DialogProps<S extends { status: JobStatus }> = {
  open: boolean;
  snapshot: S | null;
  buildView: (snapshot: S, now: number) => JobView;
  copy: JobCopy;
  onHide: () => void;
  onDone: () => void;
  onStop: () => void;
  onResume: () => void;
  onRetryFailed: () => void;
};

export function JobProgressDialog<S extends { status: JobStatus }>({
  open,
  snapshot,
  buildView,
  copy,
  onHide,
  onDone,
  onStop,
  onResume,
  onRetryFailed,
}: DialogProps<S>) {
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const active = snapshot ? isActiveStatus(snapshot.status) : false;
  const now = useNow(open && active);
  if (!snapshot) return null;

  const view = buildView(snapshot, now);
  const finishSuccess = () => {
    onHide();
    void Promise.resolve(onDone());
  };
  // Closing a finished-with-success dialog counts as "Done" (refresh the tab).
  const dismiss = view.status === "success" ? finishSuccess : onHide;
  const confirmStop = () => {
    setStopConfirmOpen(false);
    onStop();
  };
  const footer: ReactNode = (() => {
    switch (view.status) {
      case "running":
        return (
          <>
            <DashButton variant="secondary" onClick={() => setStopConfirmOpen(true)}>
              Stop
            </DashButton>
            <DashButton variant="primary" onClick={onHide}>
              Hide
            </DashButton>
          </>
        );
      case "stopping":
        return (
          <>
            <DashButton variant="secondary" disabled>
              Stopping...
            </DashButton>
            <DashButton variant="primary" onClick={onHide}>
              Hide
            </DashButton>
          </>
        );
      case "stopped":
        return (
          <>
            <DashButton variant="secondary" onClick={onHide}>
              Close
            </DashButton>
            <DashButton variant="primary" onClick={onResume}>
              Resume
            </DashButton>
          </>
        );
      case "partial":
        return (
          <>
            <DashButton variant="secondary" onClick={onHide}>
              Close
            </DashButton>
            <DashButton variant="primary" onClick={onRetryFailed}>
              Retry failed
            </DashButton>
          </>
        );
      case "failed":
        return (
          <>
            <DashButton variant="secondary" onClick={onHide}>
              Close
            </DashButton>
            <DashButton
              variant="primary"
              onClick={view.hasFailures ? onRetryFailed : onResume}
            >
              {view.hasFailures ? "Retry failed" : "Try again"}
            </DashButton>
          </>
        );
      case "success":
        return (
          <>
            {view.successRetryLabel ? (
              <DashButton variant="secondary" onClick={onRetryFailed}>
                {view.successRetryLabel}
              </DashButton>
            ) : null}
            <DashButton variant="primary" onClick={finishSuccess}>
              Done
            </DashButton>
          </>
        );
    }
  })();

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
        <DialogContent
          showClose={false}
          aria-busy={active}
          onInteractOutside={(event) => {
            if (active) event.preventDefault();
          }}
          className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-3xl shadow-none!"
        >
          <DialogHeader>
            <DialogTitle>{copy.titles[view.status]}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          <JobProgressContent view={view} copy={copy} />

          <DialogFooter className="gap-2 sm:gap-2">{footer}</DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stopConfirmOpen} onOpenChange={setStopConfirmOpen}>
        <DialogContent
          showClose={false}
          className="max-w-md rounded-3xl shadow-none!"
        >
          <DialogHeader>
            <DialogTitle>Stop this job?</DialogTitle>
            <DialogDescription>
              Stop after the current batch? Work already saved will be kept, and
              you can resume later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <DashButton
              variant="secondary"
              onClick={() => setStopConfirmOpen(false)}
            >
              Cancel
            </DashButton>
            <DashButton variant="primary" onClick={confirmStop}>
              Stop
            </DashButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Small inline strip shown on the tab while the dialog is hidden. */
export function JobProgressBanner<S extends { status: JobStatus }>({
  snapshot,
  buildView,
  copy,
  onShow,
}: {
  snapshot: S;
  buildView: (snapshot: S, now: number) => JobView;
  copy: JobCopy;
  onShow: () => void;
}) {
  const active = isActiveStatus(snapshot.status);
  const now = useNow(active);
  const view = buildView(snapshot, now);
  const model = view.bar;
  const percent =
    model.kind === "determinate" ? percentOf(model.processed, model.total) : 0;
  const text = active
    ? model.kind === "determinate" && model.total > 0
      ? `${view.stageLabel}: ${model.processed} of ${model.total} (${percent}%)${
          view.etaMs !== null
            ? ` \u00b7 about ${formatDuration(view.etaMs)} left`
            : ""
        }`
      : `${view.stageLabel}...`
    : copy.titles[view.status];

  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3"
      role="status"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-700">{text}</p>
        {model.kind === "determinate" ? (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-[#007bff] transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onShow}
        className="text-xs font-semibold text-[#007bff] hover:underline"
      >
        Show progress
      </button>
    </div>
  );
}