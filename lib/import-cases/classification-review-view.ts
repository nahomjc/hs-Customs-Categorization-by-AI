/**
 * Turns the stored suggestion (candidates + evidence JSON) into what the
 * review screen shows. Reads real stored data only; anything missing is simply
 * left out. Client-safe and pure, so it can be tested offline.
 */

import { isCatchAllHsCode } from "../hs-catch-all";
import type { SuggestionReview } from "./hs-web-step";

type CandidateLike = {
  id: string;
  hsCode: string;
  rank: number;
  officialDescription: string;
  reasoning: string;
  classificationEvidence: unknown;
};

type ClassificationLike = {
  hsCode: string | null;
  selectedCandidateId: string | null;
} | null;

export type ReviewSourceView = {
  url: string;
  title: string;
  host: string;
  /** False when only the model named it (no search citation). */
  fromSearch: boolean;
};

export type ReviewAlternativeView = {
  candidateId: string;
  hsCode: string;
  officialDescription: string;
  reason: string | null;
};

export type ClassificationReviewView = {
  /** True when the stored code is a catch-all: show "No code suggested". */
  noCode: boolean;
  /** Why a person must look closer (plain language) or null. */
  reason: string | null;
  /** The AI cannot settle it alone: the reviewer chooses between the options. */
  decisionRequired: boolean;
  /** The one question that would settle it, or null. */
  question: string | null;
  /** The reviewer's note was part of the context of this suggestion. */
  userNoteUsed: boolean;
  /** Searches that were tried (empty when no web search ran). */
  searchQueries: string[];
  confidenceNote: string | null;
  sources: ReviewSourceView[];
  webUsed: boolean;
  webError: string | null;
  previousHsCode: string | null;
  /** A code the AI/web proposed that is not usable as-is. */
  proposedHsCode: string | null;
  /** A code that was found but dropped because it does not fit the product. */
  rejectedCode: { hsCode: string; reasons: string[] } | null;
  alternatives: ReviewAlternativeView[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function buildClassificationReviewView(
  candidates: CandidateLike[],
  classification: ClassificationLike,
): ClassificationReviewView {
  const main =
    candidates.find((c) => c.id === classification?.selectedCandidateId) ??
    candidates.find((c) => c.rank === 1) ??
    candidates[0];
  const evidence = isRecord(main?.classificationEvidence)
    ? main.classificationEvidence
    : null;
  const review = (isRecord(evidence?.review) ? evidence.review : null) as
    | Partial<SuggestionReview>
    | null;

  const storedCode = classification?.hsCode ?? main?.hsCode ?? null;
  const noCode = storedCode != null && isCatchAllHsCode(storedCode);

  const sources: ReviewSourceView[] = [];
  const web = isRecord(review?.web) ? review.web : null;
  if (Array.isArray(web?.sources)) {
    for (const s of web.sources as unknown[]) {
      if (!isRecord(s) || typeof s.url !== "string") continue;
      if (!/^https?:\/\//i.test(s.url)) continue;
      sources.push({
        url: s.url,
        title: typeof s.title === "string" && s.title.trim() ? s.title.trim() : hostOf(s.url),
        host: hostOf(s.url),
        fromSearch: s.fromSearch === true,
      });
    }
  }

  const alternatives: ReviewAlternativeView[] = candidates
    .filter(
      (c) =>
        c.rank >= 2 &&
        isRecord(c.classificationEvidence) &&
        c.classificationEvidence.role === "alternative" &&
        c.hsCode !== storedCode,
    )
    .map((c) => ({
      candidateId: c.id,
      hsCode: c.hsCode,
      officialDescription: c.officialDescription === c.hsCode ? "" : c.officialDescription,
      reason: c.reasoning || null,
    }));

  const rejected = isRecord(review?.rejectedCode) ? review.rejectedCode : null;
  const previous = isRecord(review?.previous) ? review.previous : null;
  const proposed = isRecord(review?.proposedCode) ? review.proposedCode : null;

  return {
    noCode,
    reason:
      review?.required === true && typeof review.reason === "string"
        ? review.reason
        : null,
    decisionRequired: review?.decisionRequired === true,
    question: typeof review?.question === "string" ? review.question : null,
    userNoteUsed: review?.userNoteUsed === true,
    searchQueries: Array.isArray(web?.queries)
      ? (web.queries as unknown[]).filter((q): q is string => typeof q === "string")
      : [],
    confidenceNote:
      typeof review?.confidenceNote === "string" ? review.confidenceNote : null,
    sources,
    webUsed: web?.used === true,
    webError: typeof web?.error === "string" ? web.error : null,
    previousHsCode:
      previous && typeof previous.hsCode === "string" ? previous.hsCode : null,
    proposedHsCode:
      proposed && typeof proposed.hsCode === "string" ? proposed.hsCode : null,
    rejectedCode:
      rejected && typeof rejected.hsCode === "string"
        ? {
            hsCode: rejected.hsCode,
            reasons: Array.isArray(rejected.reasons)
              ? (rejected.reasons as unknown[]).filter(
                  (r): r is string => typeof r === "string",
                )
              : [],
          }
        : null,
    alternatives,
  };
}