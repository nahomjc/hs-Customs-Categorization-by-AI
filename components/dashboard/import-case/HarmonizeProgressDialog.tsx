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
  STAGE_LABELS,
  STAGE_ORDER,
  elapsedMs,
  etaMs,
  type JobSnapshot,
} from "@/lib/import-cases/harmonize-progress";

/** Harmonization wording and numbers on top of the shared JobProgressDialog. */

export const HARMONIZE_COPY: JobCopy = {
  ariaLabel: "Harmonization progress",
  titles: {
    running: "Harmonizing products",
    stopping: "Stopping after the current batch",
    stopped: "Harmonization stopped",
    success: "Harmonization complete",
    partial: "Some products failed",
    failed: "Harmonization failed",
  },
  description:
    "Matching invoice and packing lines into products, then looking up VDD references. The numbers below are counted from saved work.",
  runningNote:
    "Keep this page open until it finishes. You can hide this window and keep working on this tab. Leaving the tab stops the run after the current batch; products already created are kept.",
  stoppedNote:
    "Stopped. Products created so far are kept. Resume continues with the rest without redoing finished products.",
};

/** What the progress bar shows. Counts come straight from the snapshot. */
export function barModel(s: JobSnapshot): BarModel {
  const active = isActiveStatus(s.status);
  const productsProcessed = s.ready + s.needsReview + s.productFailures.length;
  if (s.status === "success") {
    return {
      kind: "determinate",
      processed: s.total,
      total: s.total,
      verb: "processed",
    };
  }
  if (s.stage === "vdd" && s.stageTotal > 0) {
    return {
      kind: "determinate",
      processed: s.stageProcessed,
      total: s.stageTotal,
      verb: "searched for VDD matches",
    };
  }
  if (s.total > 0 && (s.stage === "products" || !active)) {
    return {
      kind: "determinate",
      processed: productsProcessed,
      total: s.total,
      verb: "processed",
    };
  }
  if (active) return { kind: "indeterminate" };
  return { kind: "determinate", processed: 0, total: 0, verb: "processed" };
}

export function harmonizeView(s: JobSnapshot, now: number): JobView {
  const summary = s.summary;
  const summaryText = summary
    ? `Created ${summary.productCount} harmonized product(s) from ${summary.matchCount} matched pair(s)${
        summary.unmatchedInvoiceCount > 0 || summary.unmatchedPackingCount > 0
          ? `, ${summary.unmatchedInvoiceCount} unmatched invoice line(s) and ${summary.unmatchedPackingCount} unmatched packing line(s)`
          : ""
      }. ${
        summary.vddMatchTotal > 0
          ? `${summary.vddMatchTotal} VDD match(es) found.`
          : "No VDD matches found."
      }`
    : null;

  const failureLists: JobView["failureLists"] = [];
  if (s.productFailures.length > 0) {
    failureLists.push({
      title: `${s.productFailures.length} product(s) failed`,
      hint: "Nothing was saved for these. Use Retry failed to try them again.",
      items: s.productFailures,
      prefix: "Product",
    });
  }
  if (s.vddFailures.length > 0) {
    failureLists.push({
      title: `${s.vddFailures.length} VDD search(es) failed`,
      hint: "The products are saved. VDD matches are review support only.",
      items: s.vddFailures,
      prefix: "Product",
    });
  }

  return {
    status: s.status,
    stageKey: s.stage,
    stageLabel: STAGE_LABELS[s.stage],
    stages: STAGE_ORDER.map((key) => ({ key, label: STAGE_LABELS[key] })),
    stageIndex: STAGE_ORDER.indexOf(s.stage),
    bar: barModel(s),
    tiles: [
      { label: "Done", value: s.ready, tone: "text-emerald-700" },
      { label: "Needs review", value: s.needsReview, tone: "text-amber-700" },
      {
        label: "Failed",
        value: s.productFailures.length,
        tone: s.productFailures.length > 0 ? "text-red-700" : undefined,
      },
      { label: "VDD matches", value: s.vddHits },
    ],
    failureLists,
    summaryText,
    fatalError: s.fatalError,
    elapsedMs: elapsedMs(s, now),
    etaMs: etaMs(s, now),
    estimating: s.stage === "products" || s.stage === "vdd",
    hasFailures: s.productFailures.length > 0 || s.vddFailures.length > 0,
    successRetryLabel:
      s.vddFailures.length > 0 ? "Retry failed VDD searches" : null,
  };
}

/** Dialog body (pure; used by the smoke test). */
export function HarmonizeProgressContent({
  snapshot,
  now,
}: {
  snapshot: JobSnapshot;
  now: number;
}) {
  return (
    <JobProgressContent view={harmonizeView(snapshot, now)} copy={HARMONIZE_COPY} />
  );
}

type DialogProps = {
  open: boolean;
  snapshot: JobSnapshot | null;
  onHide: () => void;
  onDone: () => void;
  onStop: () => void;
  onResume: () => void;
  onRetryFailed: () => void;
};

export function HarmonizeProgressDialog(props: DialogProps) {
  return (
    <JobProgressDialog
      {...props}
      buildView={harmonizeView}
      copy={HARMONIZE_COPY}
    />
  );
}

/** Small inline strip shown on the tab while the dialog is hidden. */
export function HarmonizeProgressBanner({
  snapshot,
  onShow,
}: {
  snapshot: JobSnapshot;
  onShow: () => void;
}) {
  return (
    <JobProgressBanner
      snapshot={snapshot}
      buildView={harmonizeView}
      copy={HARMONIZE_COPY}
      onShow={onShow}
    />
  );
}