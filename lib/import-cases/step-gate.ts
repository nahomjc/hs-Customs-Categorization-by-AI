/**
 * The "Continue" check of the import-case wizard, as pure logic (no React, no
 * database) so it can be tested offline.
 *
 * Why this exists: the warnings used to be computed from the page's server
 * props at the moment of the click. After an action (verify, approve, group)
 * those props are refreshed in the background and lag by about a second, so a
 * quick click showed "step not complete" for work that was already done. The
 * check now (1) runs on fresh numbers fetched from the server and (2) walks
 * through explicit phases, so a warning is only visible once a check really
 * finished and failed.
 */

import type { WizardCompletionContext } from "./workflow-progress";
import type { WizardStepId } from "./wizard-steps";

/** Counts the Continue check needs. Small enough to fetch on every click. */
export type StepSummary = {
  hasInvoice: boolean;
  hasPacking: boolean;
  invoiceLines: number;
  unreviewedInvoiceLines: number;
  packingLines: number;
  unreviewedPackingLines: number;
  products: number;
  unverifiedProducts: number;
  verifiedProducts: number;
  /** Verified products whose HS code is not approved yet. */
  unapprovedVerifiedProducts: number;
  groupings: number;
  openChecks: number;
};

/** Numbers from data the page already holds (used when no fresh numbers exist). */
export function summarizeContext(
  ctx: WizardCompletionContext,
  openChecks: number,
): StepSummary {
  const verified = ctx.classifications.filter((c) => c.product.humanVerified);
  return {
    hasInvoice: ctx.documents.some(
      (d) =>
        d.documentType === "commercial_invoice" &&
        d.extractionStatus === "completed",
    ),
    hasPacking: ctx.documents.some(
      (d) =>
        d.documentType === "packing_list" && d.extractionStatus === "completed",
    ),
    invoiceLines: ctx.invoiceLines.length,
    unreviewedInvoiceLines: ctx.invoiceLines.filter((l) => !l.line.isReviewed)
      .length,
    packingLines: ctx.packingLines.length,
    unreviewedPackingLines: ctx.packingLines.filter((l) => !l.line.isReviewed)
      .length,
    products: ctx.products.length,
    unverifiedProducts: ctx.products.filter((p) => !p.product.humanVerified)
      .length,
    verifiedProducts: verified.length,
    unapprovedVerifiedProducts: verified.filter((c) => !c.classification?.isFinal)
      .length,
    groupings: ctx.groupings.length,
    openChecks,
  };
}

/** Human-readable gaps of a step (empty = ready to continue). */
export function getStepWarningsFromSummary(
  stepId: WizardStepId,
  s: StepSummary,
): string[] {
  const warnings: string[] = [];
  switch (stepId) {
    case "documents":
      if (!s.hasInvoice) {
        warnings.push(
          "Commercial invoice is missing or extraction is not completed.",
        );
      }
      if (!s.hasPacking) {
        warnings.push(
          "Packing list is missing or extraction is not completed.",
        );
      }
      break;
    case "invoice-lines":
      if (s.invoiceLines === 0) {
        warnings.push("No invoice lines - extract or add lines first.");
      } else if (s.unreviewedInvoiceLines > 0) {
        warnings.push(`${s.unreviewedInvoiceLines} invoice line(s) are not reviewed.`);
      }
      break;
    case "packing-lines":
      if (s.packingLines === 0) {
        warnings.push("No packing list lines - extract or add lines first.");
      } else if (s.unreviewedPackingLines > 0) {
        warnings.push(`${s.unreviewedPackingLines} packing line(s) are not reviewed.`);
      }
      break;
    case "checks":
      if (!s.hasInvoice || !s.hasPacking) {
        warnings.push("Invoice and packing list extractions should be complete.");
      }
      if (s.unreviewedInvoiceLines > 0 || s.unreviewedPackingLines > 0) {
        warnings.push("Some invoice or packing lines are still unreviewed.");
      }
      if (s.openChecks > 0) {
        warnings.push(`${s.openChecks} open check(s) need attention.`);
      }
      break;
    case "products":
      if (s.products === 0) {
        warnings.push("No harmonized products - run harmonization first.");
      } else if (s.unverifiedProducts > 0) {
        warnings.push(`${s.unverifiedProducts} product(s) are not human-verified.`);
      }
      break;
    case "classification":
      if (s.verifiedProducts === 0) {
        warnings.push("No verified products to classify.");
      } else if (s.unapprovedVerifiedProducts > 0) {
        warnings.push(
          `${s.unapprovedVerifiedProducts} product(s) need HS approval or expert review.`,
        );
      }
      break;
    case "grouping-export":
      if (s.groupings === 0) {
        warnings.push("No declaration groups - run grouping before export.");
      }
      break;
    default:
      break;
  }
  return warnings;
}

/** True when the value looks like a StepSummary (a guard for fetched JSON). */
export function isStepSummary(value: unknown): value is StepSummary {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const numbers = [
    "invoiceLines",
    "unreviewedInvoiceLines",
    "packingLines",
    "unreviewedPackingLines",
    "products",
    "unverifiedProducts",
    "verifiedProducts",
    "unapprovedVerifiedProducts",
    "groupings",
    "openChecks",
  ];
  return (
    typeof v.hasInvoice === "boolean" &&
    typeof v.hasPacking === "boolean" &&
    numbers.every((k) => typeof v[k] === "number" && Number.isFinite(v[k] as number))
  );
}

/* ------------------------------------------------------------------ */
/* The phases of one Continue click                                    */
/* ------------------------------------------------------------------ */

export type ContinueCheckState =
  | { phase: "idle" }
  | { phase: "checking"; requestId: number }
  /** The check finished and the step really has gaps: the only phase that shows warnings. */
  | { phase: "blocked"; warnings: string[] }
  /** The check could not run (network / server). No warnings are claimed. */
  | { phase: "error"; message: string };

export type ContinueCheckEvent =
  | { type: "start"; requestId: number }
  | { type: "result"; requestId: number; warnings: string[] }
  | { type: "fail"; requestId: number; message: string }
  | { type: "dismiss" };

export const CONTINUE_IDLE: ContinueCheckState = { phase: "idle" };

export function continueCheckReducer(
  state: ContinueCheckState,
  event: ContinueCheckEvent,
): ContinueCheckState {
  switch (event.type) {
    case "start":
      return { phase: "checking", requestId: event.requestId };
    case "result":
      // an answer for an older click is ignored
      if (state.phase !== "checking" || state.requestId !== event.requestId) {
        return state;
      }
      return event.warnings.length > 0
        ? { phase: "blocked", warnings: event.warnings }
        : { phase: "idle" };
    case "fail":
      if (state.phase !== "checking" || state.requestId !== event.requestId) {
        return state;
      }
      return { phase: "error", message: event.message };
    case "dismiss":
      return { phase: "idle" };
    default:
      return state;
  }
}

/** Warnings to show: only after a finished check that failed. */
export function visibleWarnings(state: ContinueCheckState): string[] {
  return state.phase === "blocked" ? state.warnings : [];
}

/** The Continue button is busy while the check runs or the next step is opening. */
export function isContinueBusy(
  state: ContinueCheckState,
  navigating: boolean,
): boolean {
  return state.phase === "checking" || navigating;
}

export function continueLabel(
  state: ContinueCheckState,
  navigating: boolean,
): string {
  if (state.phase === "checking") return "Checking...";
  if (navigating) return "Opening...";
  return "Continue";
}

/** Run a check with fresh numbers, falling back to nothing (never to stale data). */
export async function runContinueCheck(
  stepId: WizardStepId,
  load: () => Promise<StepSummary>,
): Promise<{ ok: true; warnings: string[] } | { ok: false; message: string }> {
  try {
    const summary = await load();
    return { ok: true, warnings: getStepWarningsFromSummary(stepId, summary) };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message
          ? error.message
          : "Could not check this step.",
    };
  }
}