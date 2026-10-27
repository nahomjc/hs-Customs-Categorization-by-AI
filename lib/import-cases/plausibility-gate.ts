/**
 * Plausibility gate for import-case suggestions. A word of the name that usually
 * means another kind of product (the "word check") is only a WARNING:
 *
 * - word-check warning -> the code is KEPT and offered, flagged for a person with
 *   a plain sentence naming the word and saying it is only a warning. A short AI
 *   judgement (keyword-judge.ts) may clear it. Only a real catch-all (9999 and
 *   friends) is rejected.
 * - code that disagrees with the supplier's invoice code (different chapter) ->
 *   kept, but marked "needs review" with both codes shown.
 *
 * The supplier's code is a HINT: it can be offered, never copied blindly.
 * Pure module (the tariff book is read from the in-memory cache).
 */
import { NO_CLEAR_TARIFF_MATCH, isCatchAllHsCode } from "../hs-catch-all";
import { completeHsCode, formatHsCode, hsDigits } from "../hs-code-format";
import { checkPlausibility } from "../hs-plausibility";
import type { KeywordJudgement } from "./keyword-judge";
import { findInCacheSync, getHsReferenceCacheRows } from "../hsReferenceCache";
import {
  type FirstPass,
  type ReviewAlternative,
  type StepResult,
} from "./hs-web-step";

export type GateContext = {
  /** Texts that name the product, best first (name, original wording, clean description). */
  texts: Array<string | null | undefined>;
  /** The supplier's HS code (digits) from the invoice, when there is one. */
  supplierHsCode?: string | null;
  /**
   * What a quick AI check said about a word-check warning, by the code's first 8
   * digits (see keyword-judge.ts). Nothing stored; filled per call.
   */
  judged?: Record<string, KeywordJudgement>;
};

type Rejected = { hsCode: string; reasons: string[] };

const MAX_OPTIONS = 3;

/** The invoice code is a hint: when it does not fit the description it is ignored. */
function usableSupplier(ctx: GateContext): string | null {
  const s = ctx.supplierHsCode;
  if (!s) return null;
  return checkPlausibility({ hsCode: s, texts: ctx.texts }).status === "implausible" ? null : s;
}

export function judgementKey(hsCode: string | null | undefined): string {
  return hsDigits(hsCode).slice(0, 8);
}

function verdictOf(hsCode: string, ctx: GateContext) {
  return checkPlausibility({
    hsCode,
    texts: ctx.texts,
    supplierHsCode: usableSupplier(ctx),
    keywordClearedByAi: ctx.judged?.[judgementKey(hsCode)]?.result === "fits",
  });
}

/** The word-check warning for a code (null when there is none, or the AI check cleared it). */
export function keywordConflictOf(hsCode: string, ctx: GateContext) {
  if (isCatchAllHsCode(hsCode)) return null;
  const v = verdictOf(hsCode, ctx);
  return v.status === "implausible" ? v : null;
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

/**
 * Before the web step. A word-check warning on the first answer never drops the
 * code: it stays as the earlier suggestion, its confidence is capped so the web
 * step looks again, and the final gate decides what the reviewer sees.
 * Options with a warning stay too, behind the ones without.
 */
export function gateFirstPass(
  first: FirstPass,
  ctx: GateContext,
): { first: FirstPass; rejected?: Rejected } {
  if (first.isImportItem === false || isCatchAllHsCode(first.hsCode)) {
    return { first };
  }
  const flagged = (o: { hsCode: string }) => verdictOf(o.hsCode, ctx).status === "implausible";
  const options = [...(first.options ?? [])].sort((a, b) => Number(flagged(a)) - Number(flagged(b)));
  if (!flagged(first)) return { first: { ...first, options } };
  return {
    first: {
      ...first,
      confidence: Math.min(first.confidence ?? 0.3, 0.3),
      options,
    },
  };
}

/** One sentence naming the word, what it usually means, and that it is only a warning. */
function warningSentence(v: ReturnType<typeof verdictOf>, judgement?: KeywordJudgement): string {
  const base = v.reasons[0] ?? "A word in the name usually means another kind of product. This is only a warning.";
  if (judgement?.result === "conflict") {
    return `${base} A quick AI check of the full description also thought so${judgement.note ? `: ${judgement.note}` : "."}`;
  }
  if (judgement?.result === "unsure") {
    return `${base} A quick AI check of the full description could not settle it.`;
  }
  return base;
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

  // options with a word-check warning stay (behind the others), never removed
  let alternatives = [...review.alternatives].sort(
    (a, b) =>
      Number(verdictOf(a.hsCode, ctx).status === "implausible") -
      Number(verdictOf(b.hsCode, ctx).status === "implausible"),
  );

  let disagrees = false;
  let keywordFlagged = false;
  if (!isCatchAllHsCode(hsCode)) {
    const judgement = ctx.judged?.[judgementKey(hsCode)];
    const v = verdictOf(hsCode, ctx);
    if (judgement?.result === "fits") {
      // a word looked odd, a full-description check said the code fits
      const raw = checkPlausibility({ hsCode, texts: ctx.texts });
      if (raw.status === "implausible") {
        review.keywordCleared = { word: raw.trigger, note: judgement.note };
      }
    }
    if (v.status === "implausible") {
      // Keep the code. A word of the name usually means another kind of product:
      // flag it for a person, name the word, say it is only a warning.
      keywordFlagged = true;
      confidence = Math.min(confidence, 0.55);
      review.required = true;
      review.keywordWarning = {
        word: v.trigger,
        looksLike: v.family ?? "another kind of product",
        judgement:
          judgement?.result === "conflict"
            ? "agrees"
            : judgement?.result === "unsure"
              ? "unsure"
              : "unavailable",
      };
      const sentence = warningSentence(v, judgement);
      review.reason = review.reason ? `${sentence} ${review.reason}` : sentence;
      review.confidenceNote = `${review.confidenceNote}; word-check warning`;
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
    (placeholder || disagrees || keywordFlagged) &&
    !alternatives.some((a) => sameCode(a.hsCode, sup.hsCode)) &&
    !sameCode(hsCode, sup.hsCode) &&
    verdictOf(sup.hsCode, ctx).status !== "implausible"
  ) {
    // when nothing else is known the supplier's code leads, otherwise it follows
    alternatives = placeholder && alternatives.length === 0 ? [sup] : [...alternatives, sup];
  }
  alternatives = alternatives.slice(0, MAX_OPTIONS);
  review.alternatives = alternatives;

  if (keywordFlagged && alternatives.length > 0) {
    review.decisionRequired = true;
    review.question =
      review.question ??
      `Is ${formatHsCode(hsCode).display} right for "${nameOf(ctx)}", or one of the other options?`;
  }

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