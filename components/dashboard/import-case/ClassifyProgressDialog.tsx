"use client";

import {
  JobProgressBanner,
  JobProgressContent,
  JobProgressDialog,
  isActiveStatus,
  type BarModel,
  type JobCopy,
  type JobView,
} from "@/components/dashboard/import-case/JobProgressDialog";
import {
  CLASSIFY_STAGE_LABELS,
  CLASSIFY_STAGE_ORDER,
  type ClassifySnapshot,
} from "@/lib/import-cases/classify-progress";
import { elapsedMs, etaMs } from "@/lib/import-cases/job-progress";

/** Classification wording and numbers on top of the shared JobProgressDialog. */

export const CLASSIFY_COPY: JobCopy = {
  ariaLabel: "Classification progress",
  titles: {
    running: "Classifying products",
    stopping: "Stopping after the current batch",
    stopped: "Classification stopped",
    success: "Classification complete",
    partial: "Some products failed",
    failed: "Classification failed",
  },
  description:
    "Matching each product against the tariff reference and VDD first, and asking AI with the HS chapter notes when needed. The numbers below are counted from saved work.",
  runningNote:
    "Keep this page open until it finishes. You can hide this window and keep working on this tab. Leaving the tab stops the run after the current batch; products already classified are kept.",
  stoppedNote:
    "Stopped. Products classified so far are kept. Resume continues with the rest without redoing finished products.",
};

/** Progress = products that were classified (or set aside), not failed ones. */
export function classifyBarModel(s: ClassifySnapshot): BarModel {
  const active = isActiveStatus(s.status);
  if (s.status === "success") {
    return {
      kind: "determinate",
      processed: s.total,
      total: s.total,
      verb: "classified",
    };
  }
  if (s.total > 0) {
    return {
      kind: "determinate",
      processed: s.classified + s.needsReview + s.skipped,
      total: s.total,
      verb: "classified",
    };
  }
  if (active) return { kind: "indeterminate" };
  return { kind: "determinate", processed: 0, total: 0, verb: "classified" };
}

export function classifyView(s: ClassifySnapshot, now: number): JobView {
  const summary = s.summary;
  const summaryText = summary
    ? `Classified ${summary.classifiedCount} product(s)${
        summary.needsReviewCount > 0
          ? `, ${summary.needsReviewCount} need review`
          : ""
      }${
        summary.skippedCount > 0
          ? `, ${summary.skippedCount} skipped (no description)`
          : ""
      }. ${
        summary.referencePopulated
          ? `${s.viaReference} matched from the tariff reference or VDD without AI.`
          : "The HS reference table is empty, so AI was used for classification."
      }`
    : null;

  const failureLists: JobView["failureLists"] = [];
  if (s.failures.length > 0) {
    failureLists.push({
      title: `${s.failures.length} product(s) failed`,
      hint: "No suggestion was saved for these. Use Retry failed to try them again.",
      items: s.failures,
      prefix: "Product",
    });
  }

  return {
    status: s.status,
    stageKey: s.stage,
    stageLabel: CLASSIFY_STAGE_LABELS[s.stage],
    stages: CLASSIFY_STAGE_ORDER.map((key) => ({
      key,
      label: CLASSIFY_STAGE_LABELS[key],
    })),
    stageIndex: CLASSIFY_STAGE_ORDER.indexOf(s.stage),
    bar: classifyBarModel(s),
    tiles: [
      { label: "Classified", value: s.classified, tone: "text-emerald-700" },
      { label: "Needs review", value: s.needsReview, tone: "text-amber-700" },
      {
        label: "Failed",
        value: s.failures.length,
        tone: s.failures.length > 0 ? "text-red-700" : undefined,
      },
      { label: "From reference", value: s.viaReference },
    ],
    failureLists,
    summaryText,
    fatalError: s.fatalError,
    elapsedMs: elapsedMs(s, now),
    etaMs: etaMs(s, now),
    estimating: s.stage === "classifying",
    hasFailures: s.failures.length > 0,
    successRetryLabel: null,
  };
}

/** Dialog body (pure; used by the smoke test). */
export function ClassifyProgressContent({
  snapshot,
  now,
}: {
  snapshot: ClassifySnapshot;
  now: number;
}) {
  return (
    <JobProgressContent view={classifyView(snapshot, now)} copy={CLASSIFY_COPY} />
  );
}

type DialogProps = {
  open: boolean;
  snapshot: ClassifySnapshot | null;
  onHide: () => void;
  onDone: () => void;
  onStop: () => void;
  onResume: () => void;
  onRetryFailed: () => void;
};

export function ClassifyProgressDialog(props: DialogProps) {
  return (
    <JobProgressDialog {...props} buildView={classifyView} copy={CLASSIFY_COPY} />
  );
}

/** Small inline strip shown on the tab while the dialog is hidden. */
export function ClassifyProgressBanner({
  snapshot,
  onShow,
}: {
  snapshot: ClassifySnapshot;
  onShow: () => void;
}) {
  return (
    <JobProgressBanner
      snapshot={snapshot}
      buildView={classifyView}
      copy={CLASSIFY_COPY}
      onShow={onShow}
    />
  );
}