/**
 * A cheap AI judgement for ONE kind of disagreement: a word of the product name
 * usually means one kind of product ("pot" -> kitchenware), but the code that AI /
 * web search found sits in another kind of chapter ("hot pot sauce" -> 2103.9000,
 * sauces). The full description is read and the question is short:
 *
 *   is the product the kind the WORD says, or the kind the CODE says?
 *
 * Rules:
 * - runs only when a word-check warning exists, at most twice per product;
 * - a short time budget; any failure -> "unavailable" (the warning stays, the code
 *   is kept);
 * - the answer only decides whether the warning stays; it never picks a code and
 *   never approves anything;
 * - nothing is stored by this module.
 */
import { requestJsonObject, type AiCallResult, type AiMessage } from "../ai-json";
import { completeHsCode, formatHsCode, hsDigits } from "../hs-code-format";
import { chapterOfCode, sectionOfChapter } from "../hs-plausibility";
import { findInCacheSync, getHsReferenceCacheRows } from "../hsReferenceCache";
import { fetchOpenRouter } from "../openrouterFetch";
import { judgementKey, keywordConflictOf, type GateContext } from "./plausibility-gate";

export type KeywordJudgement = {
  /**
   * "fits": the code fits the product (the word misled the check);
   * "conflict": the product is the kind the word says;
   * "unsure" / "unavailable": no answer (the warning stays, the code is kept).
   */
  result: "fits" | "conflict" | "unsure" | "unavailable";
  /** A short reason from the AI (plain text, trimmed). */
  note?: string;
};

export type JudgeInput = {
  /** The product name (best text) and the full description. */
  name: string;
  description: string;
  hsCode: string;
  /** Official tariff text of the code (may be empty). */
  codeText: string;
  /** The exact word seen in the name, when known. */
  word?: string;
  /** What the word usually means, e.g. "kitchenware". */
  looksLike: string;
};

export type JudgeCall = (
  messages: AiMessage[],
  maxTokens: number,
  timeoutMs: number,
) => Promise<AiCallResult>;

/** Total time one judgement may take (including the one retry). */
export const JUDGE_BUDGET_MS = 8_000;
const JUDGE_MODEL = "openai/gpt-4o-mini";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const JUDGE_SYSTEM = `You settle one disagreement in customs HS classification.
A word in the product name usually means one kind of product (keyword_type), but the proposed HS code belongs to another kind of product (code_type).
Read the full product description and decide which kind the product really is.
Return ONLY valid JSON: {"productType":"keyword_type"|"code_type"|"unsure","reason":"max 15 words"}`;

export function buildJudgePrompt(input: JudgeInput): AiMessage[] {
  const lines = [
    `Product name: ${input.name}`,
    input.description && input.description !== input.name ? `Full description: ${input.description}` : null,
    `Word seen in the name: "${input.word ?? "(a word of the name)"}" - usually means ${input.looksLike} (keyword_type)`,
    `Proposed HS code: ${input.hsCode}${input.codeText ? ` - ${input.codeText}` : ""} (code_type)`,
    `Question: is this product really ${input.looksLike} (keyword_type), or the kind of product the code describes (code_type)?`,
  ].filter((l): l is string => Boolean(l));
  return [
    { role: "system", content: JUDGE_SYSTEM },
    { role: "user", content: lines.join("\n") },
  ];
}

async function callOpenRouterJudge(
  messages: AiMessage[],
  maxTokens: number,
  timeoutMs: number,
): Promise<AiCallResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  const res = await fetchOpenRouter(
    OPENROUTER_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3010",
      },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        messages,
        temperature: 0,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
    },
    timeoutMs,
  );
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string | null }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response");
  return { content, finishReason: data.choices?.[0]?.finish_reason ?? null };
}

function cleanNote(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[{}\[\]"]/g, "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 120) : undefined;
}

/** Ask once (plus the robust retry from ai-json). Never throws: failure is "unavailable". */
export async function judgeKeywordConflict(
  input: JudgeInput,
  deps?: { call?: JudgeCall; budgetMs?: number; now?: () => number },
): Promise<KeywordJudgement> {
  const call = deps?.call ?? callOpenRouterJudge;
  const budget = deps?.budgetMs ?? JUDGE_BUDGET_MS;
  const now = deps?.now ?? Date.now;
  const deadline = now() + budget;
  try {
    const { parsed } = await requestJsonObject<{ productType?: string; reason?: string }>(
      async (messages, maxTokens) => {
        const left = deadline - now();
        if (left < 1_500) throw new Error("judge time budget used");
        return call(messages, maxTokens, left);
      },
      buildJudgePrompt(input),
      { maxTokens: 120, retryMaxTokens: 250, requiredKeys: ["productType"], label: "keyword judge" },
    );
    const note = cleanNote(parsed.reason);
    switch (parsed.productType) {
      case "code_type":
        return { result: "fits", note };
      case "keyword_type":
        return { result: "conflict", note };
      default:
        return { result: "unsure", note };
    }
  } catch {
    return { result: "unavailable" };
  }
}

/**
 * Judges the codes that have a word-check warning (at most `max`, in the order
 * given). Returns what the gate needs in `ctx.judged`.
 */
export async function judgeKeywordConflicts(
  codes: ReadonlyArray<string | null | undefined>,
  ctx: GateContext & { description: string },
  deps?: { call?: JudgeCall; budgetMs?: number; max?: number },
): Promise<Record<string, KeywordJudgement>> {
  const out: Record<string, KeywordJudgement> = {};
  const max = deps?.max ?? 2;
  let asked = 0;
  for (const code of codes) {
    if (!code || asked >= max) continue;
    const key = judgementKey(code);
    if (!key || key in out) continue;
    const verdict = keywordConflictOf(code, { ...ctx, judged: undefined });
    if (!verdict) continue;
    const done = completeHsCode(hsDigits(code), getHsReferenceCacheRows());
    const display = done.incomplete ? formatHsCode(code).display : done.display;
    const row = findInCacheSync(display);
    const chapter = chapterOfCode(code);
    const section = sectionOfChapter(chapter);
    asked++;
    out[key] = await judgeKeywordConflict(
      {
        name: ctx.texts.map((t) => (t ?? "").trim()).find(Boolean) ?? ctx.description,
        description: ctx.description,
        hsCode: display,
        codeText:
          (row?.description.replace(/^[-\s]+/, "").trim() ?? "") +
          (section ? ` (chapter ${chapter}: ${section.title})` : ""),
        word: verdict.trigger,
        looksLike: verdict.family ?? "another kind of product",
      },
      { call: deps?.call, budgetMs: deps?.budgetMs },
    );
  }
  return out;
}

/** True when a stored suggestion records that the AI check cleared its word-check warning. */
export function keywordClearedByAi(evidence: unknown): boolean {
  if (!evidence || typeof evidence !== "object") return false;
  const review = (evidence as { review?: unknown }).review;
  if (!review || typeof review !== "object") return false;
  const cleared = (review as { keywordCleared?: unknown }).keywordCleared;
  return !!cleared && typeof cleared === "object";
}