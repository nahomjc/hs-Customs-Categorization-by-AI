/**
 * Options and the one question for the cases where the tariff book cannot decide
 * on its own:
 *
 * - several rows match the product name equally (rice: paddy / husked / milled /
 *   broken): none is picked silently, the tied rows become ranked options;
 * - the suggestion is plausible but differs from the supplier's invoice code: both
 *   go to a person;
 * - earlier declarations (VDD) with the exact same product name agree on a code:
 *   it is offered as the top option, never as the final answer.
 *
 * The invoice code and the VDD history are hints only. Pure module (the tariff
 * book is read from the in-memory cache); nothing is approved here.
 */
import { NO_CLEAR_TARIFF_MATCH } from "../hs-catch-all";
import { completeHsCode, formatHsCode, hsDigits } from "../hs-code-format";
import { checkPlausibility } from "../hs-plausibility";
import { findInCacheSync, getHsReferenceCacheRows } from "../hsReferenceCache";
import type { ReferenceTieRow } from "../classifyFromReference";
import type { VddNameConsensus } from "../vdd/search-matches";
import { supplierOption } from "./plausibility-gate";
import {
  PLACEHOLDER_HS,
  type ReviewAlternative,
  type StepResult,
  type SuggestionReview,
} from "./hs-web-step";

/** Tied rows shown as options (the tariff may hold more). */
export const MAX_TIE_OPTIONS = 4;

type Ctx = {
  /** Texts that name the product, best first. */
  texts: Array<string | null | undefined>;
  /** The product name used for matching ("Rice"). */
  label: string;
  /** The supplier's invoice code (digits), when it was kept as a hint. */
  supplierHsCode?: string | null;
  /** Exact-name VDD agreement, when there is one. */
  vdd?: VddNameConsensus | null;
};

const EMPTY_WEB = { attempted: false, used: false, sources: [] } as const;

function eight(code: string | null | undefined): string {
  return hsDigits(code).slice(0, 8);
}

function plausible(hsCode: string, ctx: Ctx): boolean {
  return checkPlausibility({ hsCode, texts: ctx.texts }).status !== "implausible";
}

/** The VDD code as a validated tariff-book option (never a guess at a short code). */
export function vddOption(
  vdd: VddNameConsensus | null | undefined,
  ctx: Pick<Ctx, "texts">,
): ReviewAlternative | null {
  if (!vdd) return null;
  const done = completeHsCode(vdd.digits, getHsReferenceCacheRows());
  if (done.incomplete) return null;
  const row = findInCacheSync(done.display);
  if (!row) return null;
  if (!plausible(done.display, { ...ctx, label: "" })) return null;
  return {
    hsCode: done.display,
    officialDescription: row.description.replace(/^[-\s]+/, "").trim(),
    reason: `Earlier declarations (VDD) with exactly this product name used ${done.display}${vdd.count > 1 ? ` (${vdd.count} records)` : ""}. History only, not a ruling.`,
    inTariffBook: true,
    origin: "vdd",
  };
}

/**
 * Several tariff rows match equally: no code is picked. The rows become ranked
 * options (VDD history first, then the row that matches the invoice code, then the
 * rest) and the review asks one question.
 */
export function buildTieReview(tied: ReferenceTieRow[], ctx: Ctx): {
  hsCode: string;
  review: SuggestionReview;
} {
  const supplier8 = eight(ctx.supplierHsCode);
  const supplier6 = hsDigits(ctx.supplierHsCode).slice(0, 6);
  const vdd8 = eight(ctx.vdd?.digits);

  type Option = ReviewAlternative & { rank: number };
  const options: Option[] = [];
  const seen = new Set<string>();
  const push = (alt: ReviewAlternative, rank: number) => {
    const key = eight(alt.hsCode);
    if (!key || seen.has(key)) return;
    seen.add(key);
    options.push({ ...alt, rank });
  };

  for (const row of tied) {
    const key = eight(row.hsCode);
    const notes: string[] = [];
    let rank = 2;
    let origin: ReviewAlternative["origin"];
    if (vdd8 && key === vdd8) {
      notes.push("Matches earlier declarations (VDD) with exactly this product name.");
      rank = 0;
      origin = "vdd";
    }
    if (supplier8 && key === supplier8) {
      notes.push("Matches your invoice code.");
      rank = Math.min(rank, 1);
      origin = origin ?? "supplier";
    } else if (supplier6.length === 6 && key.startsWith(supplier6)) {
      notes.push("Same sub-heading as your invoice code.");
      rank = Math.min(rank, 1.5);
    }
    notes.push(`Matches "${ctx.label}" as well as the other options.`);
    push(
      {
        hsCode: row.hsCode,
        officialDescription: row.description,
        reason: notes.join(" "),
        inTariffBook: true,
        ...(origin ? { origin } : {}),
      },
      rank,
    );
  }

  // history or the invoice code point to a row the tie did not contain: still offered
  const vdd = vddOption(ctx.vdd, ctx);
  if (vdd) push(vdd, 0);
  const sup = supplierOption(ctx.supplierHsCode);
  if (sup && plausible(sup.hsCode, ctx)) push(sup, 1);

  const alternatives = options
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_TIE_OPTIONS)
    .map((o): ReviewAlternative => {
      const { rank, ...alt } = o;
      void rank;
      return alt;
    });

  const question = `Several tariff rows fit "${ctx.label}" equally. Which one is it?`;
  return {
    hsCode: PLACEHOLDER_HS,
    review: {
      required: true,
      reason: `${NO_CLEAR_TARIFF_MATCH}. ${tied.length} tariff rows match "${ctx.label}" equally, so none was picked. Choose one below.`,
      confidenceNote: "No code suggested",
      decisionRequired: true,
      question,
      alternatives,
      web: { ...EMPTY_WEB, sources: [] },
    },
  };
}

/**
 * The tariff-book suggestion is plausible but differs from the supplier's invoice
 * code (different chapter, heading or sub-heading). Both go to a person.
 */
export function buildSupplierDifferenceReview(
  hsCode: string,
  check: { reasons: string[] },
  ctx: Ctx,
): SuggestionReview {
  const sup = supplierOption(ctx.supplierHsCode);
  const usable = sup && plausible(sup.hsCode, ctx) && eight(sup.hsCode) !== eight(hsCode);
  const alternatives = usable ? [sup] : [];
  return {
    required: true,
    reason: `${check.reasons.join(" ")} Please check which one is right.`,
    confidenceNote: "Differs from the invoice code",
    decisionRequired: alternatives.length > 0,
    ...(alternatives.length > 0
      ? {
          question: `The supplier's invoice code and our suggestion (${formatHsCode(hsCode).display}) differ. Which one fits "${ctx.label}"?`,
        }
      : {}),
    alternatives,
    web: { ...EMPTY_WEB, sources: [] },
  };
}

/** Several rows were equal and the invoice code decided between them: say so, ask to confirm. */
export function buildSupplierBreakReview(hsCode: string, ctx: Ctx): SuggestionReview {
  return {
    required: true,
    reason: `Several tariff rows matched "${ctx.label}" equally. The one that matches your invoice code (${formatHsCode(hsCode).display}) was chosen. The invoice code can be wrong, please confirm it.`,
    confidenceNote: "Chosen with the invoice code as a tie-break",
    alternatives: [],
    web: { ...EMPTY_WEB, sources: [] },
  };
}

/**
 * AI / web answer plus the VDD history for the exact same name: the VDD code is
 * offered as the TOP option. A real suggestion that differs from it is kept as
 * the current suggestion but a person decides. Never final, never an override.
 */
export function applyVddNameOption(
  step: StepResult,
  vdd: VddNameConsensus | null | undefined,
  ctx: Pick<Ctx, "texts"> & { label?: string },
): StepResult {
  if (!vdd || step.isImportItem === false) return step;
  const option = vddOption(vdd, ctx);
  if (!option) return step;
  if (eight(step.hsCode) === eight(option.hsCode)) return step;

  const placeholder = !hsDigits(step.hsCode) || step.hsCode.startsWith("9999");
  const alternatives = [
    option,
    ...step.review.alternatives.filter((a) => eight(a.hsCode) !== eight(option.hsCode)),
  ].slice(0, MAX_TIE_OPTIONS);
  const name = (ctx.label ?? "").trim() || "this product";
  const review: SuggestionReview = {
    ...step.review,
    required: true,
    decisionRequired: true,
    question:
      step.review.question ??
      (placeholder
        ? `Which of these fits "${name}"?`
        : `Our suggestion (${formatHsCode(step.hsCode).display}) differs from what earlier declarations with this exact name used (${option.hsCode}). Which one fits "${name}"?`),
    alternatives,
  };
  if (!review.reason) {
    review.reason = placeholder
      ? `${NO_CLEAR_TARIFF_MATCH}. Earlier declarations with this exact name used ${option.hsCode}.`
      : `Earlier declarations with this exact name used ${option.hsCode}, which differs from the suggestion. Please check.`;
  }
  return { ...step, review };
}