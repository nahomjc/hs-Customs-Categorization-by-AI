/**
 * The "no confident tariff match" step of import-case classification.
 *
 * Input: the first AI answer (which may be a catch-all such as 9999).
 * Output: the final suggestion plus a `review` block that says, in plain
 * language, whether a human must look closer and why, with web sources, the
 * previous suggestion, ranked options and the one question that would settle
 * an unclear product.
 *
 * - Web search runs only when needed (see `shouldUseWebSearch`) and is
 *   configurable (see lib/hs-web-search.ts). For an unclear name a few
 *   different searches are tried (name + type, brand / Chinese name,
 *   supplier context) inside a time budget; the first good answer wins.
 *   Any failure falls back to the first answer.
 * - Every code is validated against the tariff book (hs_code_reference).
 *   A code that is not in the book is mapped to the closest real code or
 *   dropped ("No clear tariff match"). Codes are never invented, and options
 *   are validated the same way.
 * - Nothing here approves anything: every suggestion still needs a human.
 *
 * No database or server-only imports: the tariff-book candidates and chapter
 * notes are injected, so the whole step can be tested offline.
 */

import { NO_CLEAR_TARIFF_MATCH, isCatchAllHsCode } from "../hs-catch-all";
import { normalizeHsCode } from "../hsCodeUtils";
import type { RawHsOption } from "../hs-options";
import { resolveAgainstReference } from "../hs-reference-resolve";
import { isReferencePopulated } from "../hsReferenceCache";
import {
  getWebSearchConfig,
  runWebSearchClassification,
  type WebSearchConfig,
  type WebSearchEvidence,
  type WebSearchInput,
  type WebSearchOutput,
  type WebSearchResult,
  type WebSource,
} from "../hs-web-search";
import type { NameHints } from "./product-context";

/** Placeholder stored when no real code could be supported. */
export const PLACEHOLDER_HS = "9999";

export type FirstPass = {
  isImportItem: boolean;
  hsCode: string;
  category: string;
  cleanDescription: string;
  confidence?: number;
  noteReference?: string;
  source?: string;
  /** The AI's own likely codes when it was unsure (not yet validated). */
  options?: RawHsOption[];
  question?: string;
};

export type ReviewAlternative = {
  hsCode: string;
  officialDescription: string;
  reason?: string;
  /** False only when the tariff book was empty and the code could not be checked. */
  inTariffBook: boolean;
  /** "supplier" = the supplier's own HS code from the invoice (a hint, may be wrong). */
  origin?: "supplier";
};

export type SuggestionReview = {
  /** True = a human must look closer before approving. */
  required: boolean;
  /** Plain-language reason, e.g. "No clear tariff match". */
  reason?: string;
  /** e.g. "Medium (72%) - 3 web sources; matched in the tariff book". */
  confidenceNote: string;
  /**
   * True when the AI cannot settle it alone: the reviewer must choose between
   * the ranked `alternatives` (and/or answer `question`).
   */
  decisionRequired?: boolean;
  /** The one question that would settle it, e.g. "Is this a playing card or a gift card?" */
  question?: string;
  /** True when a reviewer note was part of the context. */
  userNoteUsed?: boolean;
  /** A code the AI/web proposed that could not be used as-is. */
  proposedCode?: {
    hsCode: string;
    validation: "exact" | "mapped" | "unverified" | "unresolved";
    note?: string;
  };
  /** The earlier suggestion this one replaced (never a catch-all). */
  previous?: { hsCode: string; source?: string; note?: string };
  /** A code that was found but NOT used because it does not fit the product. */
  rejectedCode?: { hsCode: string; reasons: string[] };
  /** Ranked, validated options (best first). */
  alternatives: ReviewAlternative[];
  web: WebSearchEvidence;
};

export type StepResult = {
  isImportItem: boolean;
  hsCode: string;
  category: string;
  cleanDescription: string;
  confidence: number;
  noteReference?: string;
  review: SuggestionReview;
};

export type StepDeps = {
  config?: WebSearchConfig;
  /** Formatted tariff-book rows for the prompt (best effort). */
  getCandidates?: (query: string) => Promise<string[]>;
  /** Chapter / section notes text for the prompt (best effort). */
  getNotes?: (
    hsCodeHints: string[],
  ) => Promise<{ text: string; chapters: string[] } | null>;
  search?: (input: WebSearchInput) => Promise<WebSearchResult>;
  /** Clock for the time budget (tests). */
  now?: () => number;
};

export type StepInput = {
  description: string;
  country?: string;
  unit?: string;
  first: FirstPass;
  /** The user clicked "Ask AI": always search. */
  forceAi?: boolean;
  /** Low-confidence tariff-book match that was not trusted. */
  weakReference?: { hsCode: string; note?: string } | null;
  /** Reviewer note (highest-priority context). */
  userNote?: string;
  /** Bounded product / shipment context block. */
  contextText?: string;
  /** Brand, Chinese / pinyin names, supplier and origin found in the data. */
  hints?: NameHints;
};

const LOW_CONFIDENCE = 0.75;
const REVIEW_CONFIDENCE = 0.6;
const MIN_CALL_MS = 8_000;
const MAX_OPTIONS_SHOWN = 3;

export function confidenceLevelLabel(confidence: number): string {
  if (confidence >= 0.85) return "High";
  if (confidence >= 0.6) return "Medium";
  return "Low";
}

export function shouldUseWebSearch(
  first: FirstPass,
  options: { forceAi?: boolean; config: WebSearchConfig },
): { use: boolean; why?: string } {
  const { config } = options;
  if (!config.enabled) return { use: false, why: "Web search is turned off" };
  if (first.isImportItem === false || first.hsCode === "EXCLUDE") {
    return { use: false, why: "Not an import item" };
  }
  if (config.mode === "always" || options.forceAi) return { use: true };
  if (isCatchAllHsCode(first.hsCode)) return { use: true };
  if ((first.confidence ?? 0.9) < LOW_CONFIDENCE) return { use: true };
  if (isReferencePopulated()) {
    const resolution = resolveAgainstReference(first.hsCode, first.cleanDescription);
    if (resolution.status !== "exact") return { use: true };
  }
  return { use: false, why: "Confident match, web search not needed" };
}

function clipText(value: string, max: number): string {
  const s = value.replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max).trim() : s;
}

/**
 * A few different searches for an unclear name, best first:
 * 1. name + product type (or the reviewer's note)
 * 2. brand / Chinese name / pinyin name (only when the data has one)
 * 3. name + supplier and origin
 * 4. name + "what is it" (only when 4 searches are allowed)
 */
export function buildSearchQueries(
  input: {
    description: string;
    category?: string;
    userNote?: string;
    hints?: NameHints;
  },
  maxQueries: number,
): string[] {
  const name = clipText(input.description, 120);
  const hints = input.hints;
  const category =
    input.category && !/^(other|non-item|unknown|unspecified)$/i.test(input.category.trim())
      ? input.category.trim()
      : "";
  const note = input.userNote ? clipText(input.userNote, 80) : "";
  const typeHint = note || hints?.productType || category;

  const queries: string[] = [];
  queries.push([name, typeHint, "HS code customs tariff"].filter(Boolean).join(" "));

  const names = [hints?.brand, ...(hints?.cjkNames ?? []), ...(hints?.pinyinNames ?? [])].filter(
    (s): s is string => !!s && s.trim().length > 0,
  );
  if (names.length > 0) {
    queries.push([...names.slice(0, 3), name, "product HS code"].join(" "));
  }

  if (hints?.supplier || hints?.origin) {
    queries.push(
      [name, hints.supplier, hints.origin ? `from ${hints.origin}` : "", "product what is it"]
        .filter(Boolean)
        .join(" "),
    );
  }
  queries.push(`${name} what is this product type`);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of queries) {
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
    if (out.length >= Math.max(1, maxQueries)) break;
  }
  return out;
}

function emptyWeb(partial: Partial<WebSearchEvidence> = {}): WebSearchEvidence {
  return { attempted: false, used: false, sources: [], ...partial };
}

function officialDescriptionOf(row: { description: string }): string {
  return row.description.replace(/^[-\s]+/, "").trim();
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function digitsOf(code: string): string {
  return code.replace(/\D/g, "");
}

/** Collects up to 3 distinct, validated options (never the primary code). */
class OptionCollector {
  readonly items: ReviewAlternative[] = [];
  private seen = new Set<string>();

  constructor(primaryCode: string | null, private hint: string) {
    if (primaryCode) this.seen.add(digitsOf(primaryCode));
  }

  /** Validate a proposed code against the tariff book; unusable codes are dropped. */
  addRaw(raw: RawHsOption, fallbackReason?: string): void {
    if (this.items.length >= MAX_OPTIONS_SHOWN) return;
    const r = resolveAgainstReference(raw.hsCode, `${this.hint} ${raw.reason ?? ""}`);
    const reason = raw.reason ?? fallbackReason;
    if (r.status === "exact") {
      this.push({
        hsCode: r.hsCode,
        officialDescription: officialDescriptionOf(r.row),
        reason,
        inTariffBook: true,
      });
    } else if (r.status === "mapped") {
      this.push({
        hsCode: r.hsCode,
        officialDescription: officialDescriptionOf(r.row),
        reason: [reason, `closest tariff-book code to ${r.requestedCode}`]
          .filter(Boolean)
          .join(" - "),
        inTariffBook: true,
      });
    } else if (r.status === "unverified") {
      this.push({ hsCode: r.hsCode, officialDescription: "", reason, inTariffBook: false });
    }
  }

  addAlt(alt: ReviewAlternative): void {
    if (this.items.length >= MAX_OPTIONS_SHOWN) return;
    this.push(alt);
  }

  private push(alt: ReviewAlternative): void {
    const key = digitsOf(alt.hsCode);
    if (!key || this.seen.has(key)) return;
    this.seen.add(key);
    this.items.push(alt);
  }
}

function decisionFlags(args: {
  required: boolean;
  hsCode: string;
  confidence: number;
  ambiguous?: boolean;
  options: ReviewAlternative[];
  question?: string;
}): boolean {
  if (!args.required) return false;
  if (args.options.length === 0 && !args.question) return false;
  return (
    isCatchAllHsCode(args.hsCode) ||
    args.confidence < REVIEW_CONFIDENCE ||
    args.ambiguous === true
  );
}

function withoutWeb(
  input: StepInput,
  web: WebSearchEvidence,
  failureNote?: string,
  extra?: { question?: string; options?: RawHsOption[] },
): StepResult {
  const { first } = input;
  const confidence = first.confidence ?? 0.9;
  if (first.isImportItem === false || first.hsCode === "EXCLUDE") {
    return {
      isImportItem: first.isImportItem,
      hsCode: first.hsCode,
      category: first.category,
      cleanDescription: first.cleanDescription,
      confidence,
      noteReference: first.noteReference,
      review: {
        required: false,
        confidenceNote: "Not an import item",
        alternatives: [],
        web,
      },
    };
  }
  const catchAll = isCatchAllHsCode(first.hsCode);
  const hint = `${input.description} ${input.userNote ?? ""}`;
  const collector = new OptionCollector(catchAll ? null : first.hsCode, hint);
  for (const o of extra?.options ?? []) collector.addRaw(o);
  for (const o of first.options ?? []) collector.addRaw(o);
  if (input.weakReference?.hsCode && !isCatchAllHsCode(input.weakReference.hsCode)) {
    collector.addRaw({
      hsCode: input.weakReference.hsCode,
      reason: input.weakReference.note ?? "Low-confidence tariff book match",
    });
  }
  const options = collector.items;
  const question = extra?.question ?? first.question;

  let reason: string | undefined;
  if (catchAll) {
    reason = `${NO_CLEAR_TARIFF_MATCH}.${
      options.length > 0
        ? " Pick one of the options below or set the code by hand."
        : failureNote
          ? ` ${failureNote}`
          : " Set the code by hand or add more detail to the product description."
    }`;
  } else if (confidence < REVIEW_CONFIDENCE) {
    reason = "Low confidence";
  }
  const required = Boolean(reason);
  const finalConfidence = catchAll ? Math.min(confidence, 0.3) : confidence;

  return {
    isImportItem: first.isImportItem,
    hsCode: catchAll ? PLACEHOLDER_HS : first.hsCode,
    category: first.category,
    cleanDescription: first.cleanDescription,
    confidence: finalConfidence,
    noteReference: first.noteReference,
    review: {
      required,
      reason,
      confidenceNote: catchAll
        ? options.length > 0
          ? `No code suggested - ${options.length} option${options.length === 1 ? "" : "s"} to choose from`
          : "No code suggested"
        : `${confidenceLevelLabel(confidence)} (${pct(confidence)}) - AI suggestion without web search`,
      decisionRequired: decisionFlags({
        required,
        hsCode: catchAll ? PLACEHOLDER_HS : first.hsCode,
        confidence: finalConfidence,
        options,
        question,
      }),
      question,
      userNoteUsed: input.userNote ? true : undefined,
      alternatives: options,
      web,
    },
  };
}

function isGoodAnswer(out: WebSearchOutput): boolean {
  if (!out.isImportItem || !out.hsCode) return false;
  if (resolveAgainstReference(out.hsCode, "").status === "unresolved") return false;
  return out.confidence >= REVIEW_CONFIDENCE && out.sources.some((s) => s.fromSearch);
}

function answerScore(out: WebSearchOutput): number {
  let score = out.confidence;
  if (out.hsCode) score += 0.5;
  if (out.hsCode && resolveAgainstReference(out.hsCode, "").status !== "unresolved") score += 1;
  if (isGoodAnswer(out)) score += 3;
  return score;
}

function mergeSources(lists: WebSource[][]): WebSource[] {
  const out: WebSource[] = [];
  for (const list of lists) {
    for (const s of list) {
      const existing = out.find((o) => o.url === s.url);
      if (existing) {
        existing.fromSearch = existing.fromSearch || s.fromSearch;
      } else {
        out.push({ ...s });
      }
    }
  }
  return out.slice(0, 8);
}

export async function applyWebSearchStep(
  input: StepInput,
  deps: StepDeps = {},
): Promise<StepResult> {
  const config = deps.config ?? getWebSearchConfig();
  const now = deps.now ?? Date.now;
  const { first } = input;
  const decision = shouldUseWebSearch(first, {
    forceAi: input.forceAi,
    config,
  });

  if (!decision.use) {
    return withoutWeb(
      input,
      emptyWeb({ skippedReason: decision.why }),
      config.enabled ? undefined : "Web search is turned off. Set the code by hand.",
    );
  }

  const query = [input.description, first.category, input.userNote]
    .filter(Boolean)
    .join(" ");
  let referenceCandidates: string[] = [];
  let notesText: string | null = null;
  let notesChapters: string[] = [];
  try {
    referenceCandidates = (await deps.getCandidates?.(query)) ?? [];
  } catch {
    referenceCandidates = [];
  }
  try {
    const notes = await deps.getNotes?.([
      first.hsCode,
      ...referenceCandidates.slice(0, 10),
    ]);
    notesText = notes?.text ?? null;
    notesChapters = notes?.chapters ?? [];
  } catch {
    notesText = null;
  }

  const baseInput: WebSearchInput = {
    description: input.description,
    country: input.country,
    unit: input.unit,
    referenceCandidates,
    notesText,
    previous: isCatchAllHsCode(first.hsCode)
      ? null
      : { hsCode: first.hsCode, category: first.category, source: first.source },
    userNote: input.userNote,
    contextText: input.contextText,
  };

  const runSearch = (i: WebSearchInput, cfg: WebSearchConfig) =>
    deps.search ? deps.search(i) : runWebSearchClassification(i, { config: cfg });

  // Several different searches for an unclear name, inside the time budget.
  const queries = buildSearchQueries(
    {
      description: input.description,
      category: first.category,
      userNote: input.userNote,
      hints: input.hints,
    },
    config.maxQueries,
  );
  const tried: string[] = [];
  const answers: WebSearchOutput[] = [];
  const errors: string[] = [];
  const t0 = now();
  for (let i = 0; i < queries.length; i++) {
    const remaining = config.budgetMs - (now() - t0);
    if (i > 0 && remaining < MIN_CALL_MS) break;
    const callConfig: WebSearchConfig = {
      ...config,
      timeoutMs: Math.max(5_000, Math.min(config.timeoutMs, remaining)),
    };
    const res = await runSearch({ ...baseInput, searchQuery: queries[i] }, callConfig);
    tried.push(queries[i]);
    if (!res.ok) {
      errors.push(res.error);
      if (/API_KEY/.test(res.error)) break;
      continue;
    }
    answers.push(res.output);
    if (isGoodAnswer(res.output)) break;
  }

  if (answers.length === 0) {
    return withoutWeb(
      input,
      emptyWeb({
        attempted: true,
        error: errors[0] ?? "Web search failed",
        model: config.model,
        queries: tried,
      }),
      "Web search was not available, so please set the code by hand.",
    );
  }

  // Best answer wins; sources, options and the question are pooled from all tries.
  const ranked = [...answers].sort((a, b) => answerScore(b) - answerScore(a));
  let out: WebSearchOutput = {
    ...ranked[0],
    sources: mergeSources(ranked.map((a) => a.sources)),
    alternatives: ranked.flatMap((a) => a.alternatives),
    question: ranked.find((a) => a.question)?.question,
  };

  // The legal notes must apply to the chapter the web answer lands in. If that
  // chapter's notes were not in the prompt, ask once more with them.
  const chosenChapter = (out.hsCode ?? "").replace(/\D/g, "").slice(0, 2);
  if (
    out.isImportItem &&
    out.hsCode &&
    chosenChapter.length === 2 &&
    deps.getNotes &&
    !notesChapters.includes(chosenChapter) &&
    config.budgetMs - (now() - t0) >= MIN_CALL_MS
  ) {
    try {
      const extra = await deps.getNotes([out.hsCode]);
      if (extra?.text) {
        const second = await runSearch(
          {
            ...baseInput,
            searchQuery: tried[0],
            notesText: extra.text,
            previous: { hsCode: out.hsCode, source: "web_search" },
          },
          {
            ...config,
            timeoutMs: Math.max(
              5_000,
              Math.min(config.timeoutMs, config.budgetMs - (now() - t0)),
            ),
          },
        );
        if (second.ok && second.output.hsCode) {
          out = {
            ...second.output,
            sources: mergeSources([second.output.sources, out.sources]),
            alternatives: [...second.output.alternatives, ...out.alternatives],
            question: second.output.question ?? out.question,
            noteReference: second.output.noteReference ?? out.noteReference,
          };
        }
      }
    } catch {
      // keep the first web answer
    }
  }

  const webBase: WebSearchEvidence = {
    attempted: true,
    used: true,
    model: out.model,
    engine: config.engine,
    sources: out.sources,
    reasoning: out.reasoning || undefined,
    queries: tried,
  };

  if (!out.isImportItem || !out.hsCode) {
    // No single code, but the model may still have given options and a question.
    return withoutWeb(
      input,
      {
        ...webBase,
        used: out.sources.length > 0 || out.alternatives.length > 0,
        error: "Web search could not settle on one code for this product",
      },
      "Web search could not find a supported code. Set the code by hand.",
      { question: out.question, options: out.alternatives },
    );
  }

  const hint = `${input.description} ${input.userNote ?? ""} ${out.reasoning}`;
  const resolution = resolveAgainstReference(out.hsCode, hint);
  const firstCatchAll = isCatchAllHsCode(first.hsCode);

  // The web code is not usable. Keep a valid earlier answer; otherwise unresolved.
  if (resolution.status === "unresolved") {
    if (!firstCatchAll) {
      const kept = withoutWeb(input, { ...webBase, used: false }, undefined, {
        question: out.question,
        options: out.alternatives,
      });
      kept.review.proposedCode = {
        hsCode: out.hsCode,
        validation: "unresolved",
        note: "Web search proposed a code that is not in the tariff book",
      };
      return kept;
    }
    const collector = new OptionCollector(null, hint);
    for (const o of out.alternatives) collector.addRaw(o);
    for (const o of first.options ?? []) collector.addRaw(o);
    if (input.weakReference?.hsCode && !isCatchAllHsCode(input.weakReference.hsCode)) {
      collector.addRaw({
        hsCode: input.weakReference.hsCode,
        reason: input.weakReference.note ?? "Low-confidence tariff book match",
      });
    }
    const options = collector.items;
    const question = out.question ?? first.question;
    const sourceNote = out.sources.length
      ? ` Web search suggested ${out.hsCode}, but it is not in the tariff book.`
      : "";
    return {
      isImportItem: true,
      hsCode: PLACEHOLDER_HS,
      category: first.category,
      cleanDescription: first.cleanDescription,
      confidence: Math.min(out.confidence, 0.3),
      noteReference: out.noteReference ?? first.noteReference,
      review: {
        required: true,
        reason: `${NO_CLEAR_TARIFF_MATCH}.${sourceNote}${
          options.length > 0 ? " Pick one of the options below." : ""
        }`,
        confidenceNote:
          options.length > 0
            ? `No code suggested - ${options.length} option${options.length === 1 ? "" : "s"} to choose from`
            : "No code suggested",
        decisionRequired: decisionFlags({
          required: true,
          hsCode: PLACEHOLDER_HS,
          confidence: 0.3,
          options,
          question,
        }),
        question,
        userNoteUsed: input.userNote ? true : undefined,
        proposedCode: {
          hsCode: out.hsCode,
          validation: "unresolved",
          note: "Not found in the tariff book",
        },
        alternatives: options,
        web: webBase,
      },
    };
  }

  const hsCode = resolution.hsCode;
  let confidence = out.confidence;
  const reasons: string[] = [];
  let validationNote = "";
  const ambiguous = resolution.status === "mapped" && resolution.ambiguous;

  if (resolution.status === "mapped") {
    confidence = Math.min(confidence, resolution.ambiguous ? 0.55 : 0.7);
    reasons.push(
      `Web search found ${resolution.requestedCode}; the closest code in the tariff book is ${hsCode}${
        resolution.ambiguous ? " (several codes fit, please pick one)" : ""
      }`,
    );
    validationNote = "mapped to the nearest tariff-book code";
  } else if (resolution.status === "unverified") {
    confidence = Math.min(confidence, 0.65);
    reasons.push("The tariff book is empty, so this code could not be checked");
    validationNote = "not checked against the tariff book";
  } else {
    validationNote = "found in the tariff book";
  }

  const hasSearchSource = out.sources.some((s) => s.fromSearch);
  if (!hasSearchSource) {
    reasons.push("No web source confirmed this code");
  }
  if (confidence < REVIEW_CONFIDENCE && reasons.length === 0) {
    reasons.push("Low confidence");
  }

  // ranked options: web ranking first, then the earlier answer, then siblings
  const collector = new OptionCollector(hsCode, hint);
  for (const o of out.alternatives) collector.addRaw(o);
  for (const o of first.options ?? []) collector.addRaw(o);
  if (!firstCatchAll) {
    collector.addRaw({
      hsCode: first.hsCode,
      reason: "Earlier AI suggestion (without web search)",
    });
  }
  if (resolution.status === "mapped") {
    for (const row of resolution.siblings.slice(0, 2)) {
      collector.addAlt({
        hsCode: row.normalizedHs ?? row.hsCode ?? row.tariffNo,
        officialDescription: officialDescriptionOf(row),
        reason: "Same subheading in the tariff book",
        inTariffBook: true,
      });
    }
  }
  if (input.weakReference?.hsCode && !isCatchAllHsCode(input.weakReference.hsCode)) {
    collector.addRaw({
      hsCode: input.weakReference.hsCode,
      reason: input.weakReference.note ?? "Low-confidence tariff book match",
    });
  }
  const alternatives = collector.items;

  let previous: SuggestionReview["previous"];
  if (!firstCatchAll) {
    const prev = normalizeHsCode(first.hsCode)?.display ?? first.hsCode;
    if (digitsOf(prev) !== digitsOf(hsCode)) {
      previous = {
        hsCode: prev,
        source: first.source ?? "ai_suggestion",
        note: "Replaced after web search",
      };
    }
  }

  const question = out.question ?? first.question;
  const required = reasons.length > 0;
  const sourceCount = out.sources.length;
  const confidenceNote = `${confidenceLevelLabel(confidence)} (${pct(confidence)}) - ${
    sourceCount > 0
      ? `${sourceCount} web source${sourceCount === 1 ? "" : "s"}`
      : "no web sources"
  }; ${validationNote}`;

  return {
    isImportItem: true,
    hsCode,
    category: first.category,
    cleanDescription: first.cleanDescription,
    confidence,
    noteReference: out.noteReference ?? first.noteReference,
    review: {
      required,
      reason: required ? reasons.join(". ") : undefined,
      confidenceNote,
      decisionRequired: decisionFlags({
        required,
        hsCode,
        confidence,
        ambiguous,
        options: alternatives,
        question,
      }),
      question: required ? question : undefined,
      userNoteUsed: input.userNote ? true : undefined,
      proposedCode:
        resolution.status === "mapped"
          ? {
              hsCode: resolution.requestedCode,
              validation: "mapped",
              note: "Not an exact tariff-book code",
            }
          : undefined,
      previous,
      alternatives,
      web: webBase,
    },
  };
}