/**
 * Plausibility gate for import-case suggestions. A code that does not fit the
 * product (HS chapter / section) is never accepted silently:
 *
 * - implausible code  -> not used. The product gets the placeholder, a plain
 *   reason, the plausible options (the supplier's own invoice code is offered as
 *   one of them when it is a real tariff-book code) and one question.
 * - code that disagrees with the supplier's invoice code (different chapter) ->
 *   kept, but marked "needs review" with both codes shown.
 *
 * The supplier's code is a HINT: it can be offered, never copied blindly.
 * Pure module (the tariff book is read from the in-memory cache).
 */
import { NO_CLEAR_TARIFF_MATCH, isCatchAllHsCode } from "../hs-catch-all";
import { completeHsCode, formatHsCode, hsDigits } from "../hs-code-format";
import { checkPlausibility } from "../hs-plausibility";
import { findInCacheSync, getHsReferenceCacheRows } from "../hsReferenceCache";
import {
  PLACEHOLDER_HS,
  type FirstPass,
  type ReviewAlternative,
  type StepResult,
} from "./hs-web-step";

export type GateContext = {
  /** Texts that name the product, best first (name, original wording, clean description). */
  texts: Array<string | null | undefined>;
  /** The supplier's HS code (digits) from the invoice, when there is one. */
  supplierHsCode?: string | null;
};

type Rejected = { hsCode: string; reasons: string[] };

const MAX_OPTIONS = 3;

function verdictOf(hsCode: string, ctx: GateContext) {
  return checkPlausibility({ hsCode, texts: ctx.texts, supplierHsCode: ctx.supplierHsCode });
}

function nameOf(ctx: GateContext): string {
  const t = ctx.texts.map((x) => (x ?? "").trim()).find(Boolean) ?? "this product";
  return t.length > 60 ? `${t.slice(0, 57)}...` : t;
}

/**
 * The supplier's invoice code as a validated option: only when it is a real,
 * complete code of the tariff book (a 4 digit heading with several sub-codes is
 * not guessed).
 */
export function supplierOption(
  supplierHsCode: string | null | undefined,
): ReviewAlternative | null {
  const digits = hsDigits(supplierHsCode);
  if (digits.length < 4) return null;
  const done = completeHsCode(digits, getHsReferenceCacheRows());
  if (done.incomplete) return null;
  const row = findInCacheSync(done.display);
  if (!row) return null;
  return {
    hsCode: done.display,
    officialDescription: row.description.replace(/^[-\s]+/, "").trim(),
    reason: "The supplier's own HS code on the invoice (a hint: the supplier may be wrong).",
    inTariffBook: true,
    origin: "supplier",
  };
}

function sameCode(a: string, b: string): boolean {
  return hsDigits(a).slice(0, 8) === hsDigits(b).slice(0, 8);
}

/** Before the web step: an implausible first answer becomes the placeholder (so the web step runs). */
export function gateFirstPass(
  first: FirstPass,
  ctx: GateContext,
): { first: FirstPass; rejected?: Rejected } {
  if (first.isImportItem === false || isCatchAllHsCode(first.hsCode)) {
    return { first };
  }
  const options = (first.options ?? []).filter(
    (o) => verdictOf(o.hsCode, ctx).status !== "implausible",
  );
  const v = verdictOf(first.hsCode, ctx);
  if (v.status !== "implausible") return { first: { ...first, options } };
  return {
    first: {
      ...first,
      hsCode: PLACEHOLDER_HS,
      confidence: Math.min(first.confidence ?? 0.3, 0.3),
      options,
      question:
        first.question ??
        `What exactly is "${nameOf(ctx)}"? The first code suggested (${first.hsCode}) is in a chapter that does not fit it.`,
    },
    rejected: { hsCode: first.hsCode, reasons: v.reasons },
  };
}

/** After the web step: the final answer is checked once more, options are filtered, the supplier code is offered. */
export function gateStepResult(
  step: StepResult,
  ctx: GateContext,
  rejectedEarlier?: Rejected,
): StepResult {
  if (step.isImportItem === false) return step;

  const review = { ...step.review };
  let hsCode = step.hsCode;
  let confidence = step.confidence;
  if (rejectedEarlier) review.rejectedCode = rejectedEarlier;

  let alternatives = review.alternatives.filter(
    (a) => verdictOf(a.hsCode, ctx).status !== "implausible",
  );

  let disagrees = false;
  if (!isCatchAllHsCode(hsCode)) {
    const v = verdictOf(hsCode, ctx);
    if (v.status === "implausible") {
      review.rejectedCode = { hsCode, reasons: v.reasons };
      hsCode = PLACEHOLDER_HS;
      confidence = Math.min(confidence, 0.3);
      review.required = true;
      review.reason = `${NO_CLEAR_TARIFF_MATCH}. The code ${step.hsCode} was not used: ${v.reasons[0] ?? "it does not fit the product."}`;
      review.confidenceNote = "No code suggested";
    } else if (v.status === "check") {
      disagrees = true;
      confidence = Math.min(confidence, 0.55);
      review.required = true;
      review.reason = `${v.reasons.join(" ")} Please check which one is right.`;
    }
  }

  const sup = supplierOption(ctx.supplierHsCode);
  const placeholder = isCatchAllHsCode(hsCode);
  if (
    sup &&
    (placeholder || disagrees) &&
    !alternatives.some((a) => sameCode(a.hsCode, sup.hsCode)) &&
    !sameCode(hsCode, sup.hsCode) &&
    verdictOf(sup.hsCode, ctx).status !== "implausible"
  ) {
    // when nothing else is known the supplier's code leads, otherwise it follows
    alternatives = placeholder && alternatives.length === 0 ? [sup] : [...alternatives, sup];
  }
  alternatives = alternatives.slice(0, MAX_OPTIONS);
  review.alternatives = alternatives;

  if ((placeholder || disagrees) && alternatives.length > 0) {
    review.required = true;
    review.decisionRequired = true;
    if (!review.question) {
      review.question = disagrees
        ? `The supplier's invoice code and our suggestion (${formatHsCode(hsCode).display}) are in different chapters. Which one fits "${nameOf(ctx)}"?`
        : `Which of these fits "${nameOf(ctx)}"?`;
    }
    if (placeholder && !review.reason) {
      review.reason = `${NO_CLEAR_TARIFF_MATCH}. Pick one of the options below.`;
    }
  }

  // Fill the best book alternative as the primary suggestion when we would
  // otherwise store 9999 — expert review still required; UI shows Expert review
  // instead of "Not classified". Do not promote unresolved proposedCode.
  if (isCatchAllHsCode(hsCode)) {
    const best = alternatives.find((a) => !isCatchAllHsCode(a.hsCode));
    if (best) {
      hsCode = best.hsCode;
      confidence = Math.min(confidence, 0.45);
      review.required = true;
      review.decisionRequired = true;
      review.confidenceNote =
        review.confidenceNote && !/no code suggested/i.test(review.confidenceNote)
          ? review.confidenceNote
          : "Best option filled — confirm or pick another";
      if (!review.reason) {
        review.reason = `${NO_CLEAR_TARIFF_MATCH}. Best option filled for review; confirm or pick another.`;
      }
      // Keep best in alternatives for the decision UI (rank still lists it).
      if (!review.question) {
        review.question = `Which of these fits "${nameOf(ctx)}"?`;
      }
    }
  }

  return { ...step, hsCode, confidence, review };
}