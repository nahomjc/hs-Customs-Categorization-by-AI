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
  GROUPING_STAGE_LABELS,
  GROUPING_STAGE_ORDER,
  type GroupingSnapshot,
} from "@/lib/import-cases/grouping-progress";
import { elapsedMs, etaMs } from "@/lib/import-cases/job-progress";

/** Declaration-grouping wording and numbers on top of the shared JobProgressDialog. */

export const GROUPING_COPY: JobCopy = {
  ariaLabel: "Declaration grouping progress",
  titles: {
    running: "Grouping products",
    stopping: "Stopping after the current batch",
    stopped: "Grouping stopped",
    success: "Grouping complete",
    partial: "Some groups failed",
    failed: "Grouping failed",
  },
  description:
    "Combining approved products with the same HS code, origin, procedure, tax profile and unit into declaration lines. The numbers below are counted from saved groups.",
  runningNote:
    "Keep this page open until it finishes. You can hide this window and keep working on this tab. Leaving the tab stops the run after the current batch; groups already saved are kept.",
  stoppedNote:
    "Stopped. Groups saved so far are kept. Resume continues with the rest without redoing finished groups.",
};

/** Progress = declaration groups saved. */
export function groupingBarModel(s: GroupingSnapshot): BarModel {
  const active = isActiveStatus(s.status);
  if (s.status === "success") {
    return {
      kind: "determinate",
      processed: s.total,
      total: s.total,
      verb: "created",
      noun: "groups",
    };
  }
  if (s.total > 0) {
    return {
      kind: "determinate",
      processed: s.groups,
      total: s.total,
      verb: "created",
      noun: "groups",
    };
  }
  if (active) return { kind: "indeterminate" };
  return {
    kind: "determinate",
    processed: 0,
    total: 0,
    verb: "created",
    noun: "groups",
  };
}

export function groupingView(s: GroupingSnapshot, now: number): JobView {
  const summary = s.summary;
  const summaryText = summary
    ? `Created ${summary.groupCount} declaration group(s) from ${summary.productCount} product(s). They are ready for review and export.`
    : null;

  const failureLists: JobView["failureLists"] = [];
  if (s.failures.length > 0) {
    failureLists.push({
      title: `${s.failures.length} group(s) failed`,
      hint: "These groups were not saved. Use Retry failed to try them again.",
      items: s.failures,
      prefix: "Group",
    });
  }

  return {
    status: s.status,
    stageKey: s.stage,
    stageLabel: GROUPING_STAGE_LABELS[s.stage],
    stages: GROUPING_STAGE_ORDER.map((key) => ({
      key,
      label: GROUPING_STAGE_LABELS[key],
    })),
    stageIndex: GROUPING_STAGE_ORDER.indexOf(s.stage),
    bar: groupingBarModel(s),
    tiles: [
      { label: "Groups created", value: s.groups, tone: "text-emerald-700" },
      { label: "Products grouped", value: s.products },
      { label: "Total quantity", value: s.quantity },
      {
        label: "Failed",
        value: s.failures.length,
        tone: s.failures.length > 0 ? "text-red-700" : undefined,
      },
    ],
    failureLists,
    summaryText,
    fatalError: s.fatalError,
    elapsedMs: elapsedMs(s, now),
    etaMs: etaMs(s, now),
    estimating: s.stage === "writing",
    hasFailures: s.failures.length > 0,
    successRetryLabel: null,
  };
}

/** Dialog body (pure; used by the smoke test). */
export function GroupingProgressContent({
  snapshot,
  now,
}: {
  snapshot: GroupingSnapshot;
  now: number;
}) {
  return (
    <JobProgressContent view={groupingView(snapshot, now)} copy={GROUPING_COPY} />
  );
}

type DialogProps = {
  open: boolean;
  snapshot: GroupingSnapshot | null;
  onHide: () => void;
  onDone: () => void;
  onStop: () => void;
  onResume: () => void;
  onRetryFailed: () => void;
};

export function GroupingProgressDialog(props: DialogProps) {
  return (
    <JobProgressDialog {...props} buildView={groupingView} copy={GROUPING_COPY} />
  );
}

/** Small inline strip shown on the tab while the dialog is hidden. */
export function GroupingProgressBanner({
  snapshot,
  onShow,
}: {
  snapshot: GroupingSnapshot;
  onShow: () => void;
}) {
  return (
    <JobProgressBanner
      snapshot={snapshot}
      buildView={groupingView}
      copy={GROUPING_COPY}
      onShow={onShow}
    />
  );
}