import {
  ALLOWED_HS_CODES,
  isNonItemCategory,
  validateClassification,
} from "./allowedHsCodes";
import { parseOptions, parseQuestion } from "./hs-options";
import { buildContextPromptBlock } from "./import-cases/product-context";
import { applyAssessorRules } from "./assessorRules";
import { applyGriRuleEngine, type HsFeatures } from "./griRuleEngine";
import {
  formatReferenceCandidate,
  loadHsReferenceCache,
  searchDescriptions,
  searchDescriptionsInChapters,
} from "./hsReference";
import {
  getHsReferenceCacheRows,
  isReferencePopulated,
  type HsReferenceCacheRow,
  type MatchHints,
} from "./hsReferenceCache";
import {
  buildChapterNotesPromptBlock,
  PROMPT_MAX_CHAPTERS,
  type ChapterNotesPromptBlock,
} from "./hs-chapter-notes";
import { normalizeChapter } from "./hs-chapter-notes-schema";
import { fetchOpenRouter } from "./openrouterFetch";
import { requestJsonObject, type AiCallResult, type AiMessage } from "./ai-json";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ClassificationResult {
  isImportItem: boolean;
  category: string;
  hsCode: string;
  cleanDescription: string;
  confidence?: number;
  /**
   * Import (tariff) mode: Chapter/Section note that decided the outcome,
   * e.g. "Chapter 4 Note 1(a)". Only set when a note was applied.
   */
  noteReference?: string;
  /**
   * Tariff mode: when the model is unsure, its 2-3 most likely codes (best
   * first, NOT yet validated against the tariff book) ...
   */
  options?: Array<{ hsCode: string; reason?: string }>;
  /** ... and the one question that would settle it. */
  question?: string;
}

export type ClassifyItemMode = "furniture" | "tariff";

export interface ClassifyItemOptions {
  country?: string;
  unit?: string;
  /** Import-case / tariff mode: food, oils, general goods — not furniture-only. */
  mode?: ClassifyItemMode;
  /**
   * Optional VDD historical evidence text for the reasoning step.
   * Decision support only — must not auto-copy HS codes.
   */
  vddEvidenceText?: string;
  /** When true, skip legacy FORCE_RULES inside applyAssessorRules. */
  skipAssessorForceRules?: boolean;
  /** Bounded product / shipment context block (see import-cases/product-context.ts). */
  contextText?: string;
  /** Reviewer note: highest-priority context. */
  userNote?: string;
  /** A person already confirmed this is a product: never answer "not an item". */
  assumeImportItem?: boolean;
  /** Extra words for the tariff-book candidate search (e.g. product type). */
  searchHint?: string;
  /** The supplier's HS code (digits) from the invoice: ranks its chapter / heading first. A hint only. */
  supplierHsCode?: string;
}

const ALLOWED_HS_LIST = [...ALLOWED_HS_CODES].join(", ");

function buildFurnitureSystemPrompt(allowedList: string): string {
  return `You are a customs assessor. You NEVER invent HS codes. You choose ONLY from the allowed list.

Step 1 — Is this a physical import item?
- If the line is: document title, address, phone, date, "Packing List", "SQM" (unit only), "TIN NO", company name, "Unspecified item", "Geographical area", or any header/metadata → answer NO.
- If it describes a tangible product that can be imported (lamp, chair, wallpaper, fan, etc.) → answer YES.

Step 2 — If YES: What is the product? Write one short clean description (e.g. "Floor standing lamp", "Cafe chair").

Step 3 — Assign ONE category from: Lighting equipment, Furniture, Chairs & seating, Decor/artificial plants, HVAC (AC/fans), Textile/wallpaper, Hardware (handles/fittings), Decorative ceramics, Electrical equipment, Other.

Step 4 — Choose HS code ONLY from this list (no other codes allowed):
${allowedList}
Use format 9405 or 9405.10. For "Unclassified" real items use 9999. For non-items use EXCLUDE.

Rules (HS rulebook — do not guess by "meaning"):
- Lamps/lights (fixtures, pendants, floor lamps) → 9405. Replaceable LED bulbs / LED light sources → 8539.50 (not 9405). Chairs, sofas, stools → 9401. Tables, cabinets, shelves → 9403.
- Artificial plants, flowers → 6702. Sculptures, statuary → 9703 (NOT 6702).
- Wallpaper, wall coverings → 4814 (NOT 9404; 9404 is bedding/mattress).
- Ceramic vases, decorative ceramics → 6913 (NOT 6702).
- AC units → 8415. Fans → 8414. Fountain pumps / water features → 8413.
- Fibreglass / glass-wool heat insulation → 7019 (NOT 9999).
- Avoid 9999 unless the item is truly unclear; prefer a specific chapter when possible.
- Never use 0000.00 or 9999.99. Never invent a code not in the list.

Return ONLY valid JSON, no markdown:
{"isImportItem":true|false,"category":"Category Name","hsCode":"XXXX" or "EXCLUDE","cleanDescription":"Short product description"}`;
}

function buildTariffSystemPrompt(
  allowedList: string,
  hasReferenceCandidates: boolean,
  /** Legal chapter/section notes block (import classification). Omitted = unchanged prompt. */
  notesText?: string,
  allowRedirect = true,
  assumeProduct = false,
): string {
  const step4 = hasReferenceCandidates
    ? `Step 4 — Pick the BEST matching HS code from the tariff reference candidates below.
- Match on product type, material, processing (e.g. crude vs refined oil), and intended use.
- Prefer the most specific subheading when multiple candidates fit.
- Only use 9999 when no candidate is a reasonable match.

Tariff reference candidates (choose one HS code from this list):
${allowedList}`
    : `Step 4 — Assign the correct WCO Harmonized System code (format #### or ####.##).
Examples: soybean oil → 1507.90, palm olein → 1511.90, green tea → 0902.10, sugar → 1701.99, tomato paste → 2002.90, kidney beans → 0713.33, chicken luncheon meat → 1602.32.
Use 9999 only when truly unknown. Use EXCLUDE for non-items.

${allowedList}`;

  const notesSection = notesText
    ? `

Legal chapter and section notes (authoritative - they override guessing from the product name):
${notesText}

How to use the notes:
- Check the item against the notes' exclusions ("does not cover") and inclusions before choosing a code.
- If a note excludes the item from a chapter, do NOT choose a code from that chapter.${
        allowRedirect
          ? `
- If a note sends the item to a different chapter and no candidate above belongs to that chapter, set "hsCode" to "9999" and set "redirectChapter" to that two-digit chapter number (e.g. "17"). Otherwise leave "redirectChapter" empty.`
          : ""
      }
- When a note decided the outcome (excluded the item, redirected it, or confirmed the chapter), set "noteReference" to a short citation such as "Chapter 4 Note 1(a)" or "Section XI Note 2(a)". Otherwise set it to "".
- The notes never allow inventing codes: still choose only from the candidates above (or the allowed format).`
    : "";
  const jsonFormat = notesText
    ? `{"isImportItem":true|false,"category":"Category Name","hsCode":"####.## or EXCLUDE or 9999","cleanDescription":"Short product description","confidence":0.0-1.0,"options":[{"hsCode":"","reason":""}],"question":"","noteReference":""${allowRedirect ? ',"redirectChapter":""' : ""}}`
    : `{"isImportItem":true|false,"category":"Category Name","hsCode":"####.## or EXCLUDE or 9999","cleanDescription":"Short product description","confidence":0.0-1.0,"options":[{"hsCode":"","reason":""}],"question":""}`;

  const assumeRule = assumeProduct
    ? `

This line was already confirmed by a person as a real product: always set "isImportItem" to true and never answer EXCLUDE for it.`
    : "";
  const optionsRule = `

When the product name is unclear (a brand, nickname or translated name), use the context lines and any reviewer note to work out what it most likely is. If you are still not sure, do not answer 9999 silently: put your best code in "hsCode" with a LOW "confidence" (below 0.5), list the 2-3 most likely real codes in "options" (best first, each with a short reason; only codes from the candidates above when candidates are given) and put the one short question that would settle it in "question". When you are sure, leave "options" empty and "question" empty.

If the context shows a supplier HS code, treat it only as a HINT about the right chapter (suppliers are often wrong). Never copy it blindly, and never choose a code from a chapter that does not fit the kind of product (food and drink belong in chapters 02-24, not in machinery, vehicles, glass or clothing).`;

  return `You are a customs HS classifier for import shipments (WCO Harmonized System / Ethiopian tariff).

Step 1 — Is this a physical import product (food, oil, machinery, textile, chemical, etc.)?
- Headers, addresses, invoice titles, units only → answer NO (EXCLUDE).
- Tangible goods → answer YES.

Step 2 — Write one short clean product description.

Step 3 — Assign a product category (e.g. Vegetable oils, Tea, Sugar, Prepared meat, Pulses, Furniture, Other).

${step4}

Never use 0000.00 or 9999.99.${notesSection}${assumeRule}${optionsRule}

Return ONLY valid JSON, no markdown:
${jsonFormat}`;
}

async function buildAllowedListForItem(
  description: string,
  features: HsFeatures & { isImportItem?: boolean },
  mode: ClassifyItemMode,
  extraQuery = "",
  supplierHsCode = "",
): Promise<{
  list: string;
  hasReferenceCandidates: boolean;
  /** Tariff reference rows offered to the model (when the reference table is populated). */
  candidates?: HsReferenceCacheRow[];
}> {
  await loadHsReferenceCache();

  const keywords = Array.isArray(features.keywords) ? features.keywords : [];
  const searchQuery = [description, features.itemType, features.material, features.use, extraQuery]
    .filter(Boolean)
    .join(" ");

  if (isReferencePopulated()) {
    const supplierDigits = supplierHsCode.replace(/\D/g, "");
    const hints: MatchHints | undefined =
      supplierDigits.length >= 4
        ? { supplierChapter: supplierDigits.slice(0, 2), supplierHeading: supplierDigits.slice(0, 4) }
        : undefined;
    let candidates = await searchDescriptions(
      `${searchQuery} ${keywords.join(" ")}`,
      mode === "tariff" ? 30 : 40,
      hints,
    );

    // the supplier's heading is a hint: offer a few of its real codes first
    if (hints?.supplierHeading) {
      const heading = hints.supplierHeading;
      const own = getHsReferenceCacheRows()
        .filter((r) => {
          const d = (r.normalizedHs ?? r.hsCode ?? r.tariffNo ?? "").replace(/\D/g, "");
          return d.length >= 8 && d.startsWith(heading);
        })
        .slice(0, 6);
      const seen = new Set(own.map((r) => r.tariffNo));
      candidates = [...own, ...candidates.filter((r) => !seen.has(r.tariffNo))].slice(
        0,
        mode === "tariff" ? 30 : 40,
      );
    }

    if (candidates.length > 0) {
      const fromReference = candidates.map((row) =>
        formatReferenceCandidate(row),
      );
      return {
        list: [...fromReference, "9999", "EXCLUDE"].join("\n"),
        hasReferenceCandidates: true,
        candidates,
      };
    }
  }

  if (mode === "tariff") {
    return {
      list: "Assign any valid WCO HS code (#### or ####.##). Use 9999 if unknown. EXCLUDE for non-items.",
      hasReferenceCandidates: false,
    };
  }

  if (!isReferencePopulated()) {
    return { list: ALLOWED_HS_LIST, hasReferenceCandidates: false };
  }

  return {
    list: `${ALLOWED_HS_LIST}, 9999`,
    hasReferenceCandidates: false,
  };
}

const FEATURE_EXTRACTOR_PROMPT = `You are a feature extractor for HS classification.
Extract product features from one packing-list line.
If the line is not a physical import item, still return JSON and set isImportItem=false.
If the text says a person already confirmed it is a product, set isImportItem=true.
If the name is a brand, nickname or translated name, use the context to guess the most likely product type and put your guesses in "keywords".

Return ONLY valid JSON:
{"isImportItem":true|false,"itemType":"short noun","material":"material or unknown","use":"main use or unknown","keywords":["k1","k2"]}`;

function extractJson<T>(content: string): T {
  const cleaned = content.replace(/^```json\s*|\s*```$/g, "").trim();
  return JSON.parse(cleaned) as T;
}

/** Like callOpenRouter, but also says why the model stopped ("length" = cut off). */
async function callOpenRouterDetailed(
  messages: AiMessage[],
  maxTokens = 256,
  options?: { json?: boolean },
): Promise<AiCallResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[HS classifyItem] OPENROUTER_API_KEY is not set");
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const res = await fetchOpenRouter(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3010",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages,
      temperature: 0.2,
      max_tokens: maxTokens,
      ...(options?.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok && options?.json && res.status === 400) {
    // the model / provider does not take response_format: ask again without it
    return callOpenRouterDetailed(messages, maxTokens);
  }

  if (!res.ok) {
    const err = await res.text();
    console.error(
      "[HS classifyItem] OpenRouter API error:",
      res.status,
      err?.slice(0, 200),
    );
    throw new Error(`OpenRouter API error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: { content?: string };
      finish_reason?: string | null;
    }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from OpenRouter");
  return { content, finishReason: data.choices?.[0]?.finish_reason ?? null };
}

async function callOpenRouter(messages: AiMessage[], maxTokens = 256) {
  return (await callOpenRouterDetailed(messages, maxTokens)).content;
}

/** JSON answer: retried once when cut off / invalid; the raw text only goes to the server log. */
function requestAiJson<T>(
  messages: AiMessage[],
  options: { maxTokens: number; requiredKeys: readonly string[]; label: string },
) {
  return requestJsonObject<T>(
    (msgs, max) => callOpenRouterDetailed(msgs, max, { json: true }),
    messages,
    {
      maxTokens: options.maxTokens,
      retryMaxTokens: Math.max(options.maxTokens * 2, 1500),
      requiredKeys: options.requiredKeys,
      label: options.label,
      log: (m) => console.warn(`[HS classifyItem] ${m}`),
    },
  );
}

/** Larger completion budget when the notes fields (noteReference/redirectChapter) are requested. */
const NOTES_MAX_TOKENS = 1000;

type NotedClassification = ClassificationResult & { redirectChapter?: string };

function chapterFromCode(code: string | null | undefined): string | null {
  const digits = (code ?? "").replace(/\D/g, "");
  return digits.length >= 2 ? normalizeChapter(digits.slice(0, 2)) : null;
}

/**
 * Chapters most likely to apply to the item: GRI rule-engine suggestions
 * first, then the best-ranked tariff reference candidates. Max 3.
 */
function pickCandidateChapters(
  candidates: HsReferenceCacheRow[] | undefined,
  griCodes: string[],
  max = PROMPT_MAX_CHAPTERS,
): string[] {
  const scores = new Map<string, number>();
  const add = (chapter: string | null, weight: number) => {
    if (chapter) scores.set(chapter, (scores.get(chapter) ?? 0) + weight);
  };
  griCodes.forEach((code, i) => add(chapterFromCode(code), Math.max(1, 12 - i)));
  (candidates ?? []).forEach((row, i) =>
    add(
      normalizeChapter(row.chapter) ??
        chapterFromCode(row.hsCode ?? row.tariffNo),
      Math.max(1, 30 - i),
    ),
  );
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([chapter]) => chapter);
}

/**
 * When the notes send the item to a chapter that was not among the first-pass
 * candidates, re-run the reasoning once with that chapter's candidates + notes.
 * Returns null (keep first pass) when there is no redirect or anything fails.
 */
async function applyNoteRedirect(args: {
  features: HsFeatures;
  userContent: string;
  description: string;
  first: NotedClassification;
  consideredChapters: string[];
}): Promise<{ parsed: NotedClassification; content: string } | null> {
  const { first, features } = args;
  const target = normalizeChapter(first.redirectChapter);
  if (!target || first.isImportItem === false) return null;
  if (args.consideredChapters.includes(target)) return null;

  try {
    const query = [
      args.description,
      features.itemType,
      features.material,
      features.use,
      ...(Array.isArray(features.keywords) ? features.keywords : []),
    ]
      .filter(Boolean)
      .join(" ");
    const rows = isReferencePopulated()
      ? await searchDescriptionsInChapters(query, [target], 30)
      : [];
    const notes = await buildChapterNotesPromptBlock([target]);
    const list =
      rows.length > 0
        ? [...rows.map((row) => formatReferenceCandidate(row)), "9999", "EXCLUDE"].join("\n")
        : `Assign the correct WCO HS code within chapter ${target} (format #### or ####.##). Use 9999 if unknown. EXCLUDE for non-items.`;
    const systemPrompt = buildTariffSystemPrompt(
      list,
      rows.length > 0,
      notes?.text,
      false,
    );
    const content = await callOpenRouter(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${args.userContent}\n\nThe legal notes redirected this item to Chapter ${target}${first.noteReference ? ` (${first.noteReference})` : ""}. Choose the best code in Chapter ${target}.`,
        },
      ],
      NOTES_MAX_TOKENS,
    );
    const second = extractJson<NotedClassification>(content);
    if (!second.hsCode) return null;
    const firstRef =
      typeof first.noteReference === "string" ? first.noteReference.trim() : "";
    const secondRef =
      typeof second.noteReference === "string" ? second.noteReference.trim() : "";
    second.noteReference =
      firstRef && secondRef && firstRef !== secondRef
        ? `${firstRef}; ${secondRef}`
        : secondRef || firstRef;
    console.log("[HS classifyItem] notes redirected to chapter", target);
    return { parsed: second, content };
  } catch (error) {
    console.warn(
      "[HS classifyItem] note redirect failed, keeping first pass:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function classifyItem(
  description: string,
  options?: ClassifyItemOptions,
): Promise<ClassificationResult & { aiRawResponse?: string }> {
  const mode = options?.mode ?? "furniture";
  console.log(
    "[HS classifyItem] calling API for:",
    `${description.slice(0, 60)}${description.length > 60 ? "..." : ""}`,
  );

  let featureUserContent = `Line from packing list: "${description}"`;
  if (options?.country) {
    featureUserContent += `\nCountry of origin: ${options.country}`;
  }
  if (options?.unit) {
    featureUserContent += `\nUnit: ${options.unit}`;
  }

  const contextBlock = buildContextPromptBlock({
    contextText: options?.contextText,
    userNote: options?.userNote,
    assumeImportItem: options?.assumeImportItem,
  });
  if (contextBlock) featureUserContent += `\n\n${contextBlock}`;

  // Step 1: Feature extractor (AI)
  const { parsed: features } = await requestAiJson<
    HsFeatures & { isImportItem?: boolean }
  >(
    [
      { role: "system", content: FEATURE_EXTRACTOR_PROMPT },
      { role: "user", content: featureUserContent },
    ],
    { maxTokens: 400, requiredKeys: ["isImportItem", "itemType"], label: "feature extractor" },
  );

  // Step 2: GRI rule engine (code)
  const gri = applyGriRuleEngine({
    itemType: features.itemType || "unknown",
    material: features.material || "unknown",
    use: features.use || "unknown",
    keywords: Array.isArray(features.keywords) ? features.keywords : [],
  });

  // Step 3: OpenRouter reasoning
  let reasoningUserContent = `Line from packing list: "${description}"`;
  if (options?.country) {
    reasoningUserContent += `\nCountry of origin: ${options.country}`;
  }
  if (options?.unit) {
    reasoningUserContent += `\nUnit: ${options.unit}`;
  }
  reasoningUserContent += `\nExtracted features JSON: ${JSON.stringify(features)}\nGRI rule-engine candidate HS: ${gri.suggestedHsCodes.join(", ")}\nGRI rationale: ${gri.rationale}`;

  if (contextBlock) reasoningUserContent += `\n\n${contextBlock}`;

  if (options?.vddEvidenceText?.trim()) {
    reasoningUserContent += `\n\n${options.vddEvidenceText.trim()}\nRules for VDD: use only as supporting evidence. Do NOT automatically copy an HS code from a VDD record. Do NOT choose a code because it has a lower duty. Historical data does not guarantee the current classification.`;
  }

  const {
    list: allowedList,
    hasReferenceCandidates,
    candidates,
  } = await buildAllowedListForItem(
    description,
    features,
    mode,
    [options?.userNote, options?.searchHint].filter(Boolean).join(" "),
    options?.supplierHsCode ?? "",
  );

  // Import (tariff) mode only: legal Chapter/Section notes for the likely chapters.
  // No notes in the database => notesBlock is null and the prompt is unchanged.
  let notesBlock: ChapterNotesPromptBlock | null = null;
  if (mode === "tariff") {
    notesBlock = await buildChapterNotesPromptBlock(
      pickCandidateChapters(
        candidates,
        options?.supplierHsCode
          ? [options.supplierHsCode, ...gri.suggestedHsCodes]
          : gri.suggestedHsCodes,
      ),
    );
    if (notesBlock) {
      console.log(
        "[HS classifyItem] chapter notes in prompt:",
        notesBlock.chapters.join(", "),
      );
    }
  }

  const systemPrompt =
    mode === "tariff"
      ? buildTariffSystemPrompt(
          allowedList,
          hasReferenceCandidates,
          notesBlock?.text,
          true,
          options?.assumeImportItem === true,
        )
      : buildFurnitureSystemPrompt(allowedList);

  // A long answer (options, a question, notes) used to be cut at 500 tokens: more
  // room, one stricter retry, and never the raw text in the error.
  const reasoning = await requestAiJson<NotedClassification>(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: reasoningUserContent },
    ],
    {
      maxTokens: notesBlock ? NOTES_MAX_TOKENS : mode === "tariff" ? 900 : 600,
      requiredKeys: ["isImportItem", "hsCode", "category", "cleanDescription"],
      label: "reasoning",
    },
  );
  let content = reasoning.content;
  let parsed: NotedClassification = reasoning.parsed;

  if (notesBlock) {
    const redirected = await applyNoteRedirect({
      features,
      userContent: reasoningUserContent,
      description,
      first: parsed,
      consideredChapters: notesBlock.chapters,
    });
    if (redirected) {
      parsed = redirected.parsed;
      content = redirected.content;
    }
  }
  delete parsed.redirectChapter;

  console.log(
    "[HS classifyItem] AI raw → hsCode:",
    parsed.hsCode,
    "| category:",
    parsed.category,
    "| isImportItem:",
    parsed.isImportItem,
  );

  // A person already confirmed this is a product: "not an item" is not allowed,
  // an unsure answer becomes a catch-all that the review step turns into options.
  const assume = options?.assumeImportItem === true;
  if (assume) {
    parsed.isImportItem = true;
    if (!parsed.hsCode || parsed.hsCode === "EXCLUDE") parsed.hsCode = "9999";
    if (isNonItemCategory(parsed.category)) parsed.category = "Other";
  }

  // Normalize: non-items must have EXCLUDE and consistent category
  if (
    !assume &&
    (parsed.isImportItem === false || features.isImportItem === false)
  ) {
    parsed.hsCode = "EXCLUDE";
    parsed.category = "Non-item";
    parsed.isImportItem = false;
  }
  if (parsed.hsCode === "9999.99" || parsed.hsCode === "0000.00")
    parsed.hsCode = "9999";

  const inputDesc = description.trim();
  const final = applyAssessorRules(inputDesc, parsed, {
    skipForceRules: options?.skipAssessorForceRules === true,
  });
  if (final.hsCode !== parsed.hsCode) {
    console.log(
      "[HS classifyItem] assessor override:",
      parsed.hsCode,
      "→",
      final.hsCode,
      "| category:",
      final.category,
    );
  }

  // Senior-assessor validation: exact HS only, category gate, no hallucinated subcodes
  const validated = validateClassification({
    hsCode: final.hsCode,
    category: final.category,
  });
  if (validated.status === "exclude" && !assume) {
    final.hsCode = validated.hsCode;
    final.category = "Non-item";
    final.isImportItem = false;
  } else if (validated.status === "exclude") {
    final.hsCode = "9999";
    final.isImportItem = true;
  } else if (
    validated.status === "review" &&
    validated.hsCode !== final.hsCode
  ) {
    console.log(
      "[HS classifyItem] validation → review (exact HS):",
      final.hsCode,
      "→",
      validated.hsCode,
    );
    final.hsCode = validated.hsCode;
  } else if (validated.status === "valid") {
    final.hsCode = validated.hsCode;
  }

  if (assume && (final.hsCode === "EXCLUDE" || final.isImportItem === false)) {
    final.hsCode = "9999";
    final.isImportItem = true;
    if (isNonItemCategory(final.category)) final.category = "Other";
  }

  return {
    ...final,
    isImportItem: final.isImportItem !== false,
    options: parseOptions(parsed.options),
    question: parseQuestion(parsed.question),
    confidence: final.confidence ?? parsed.confidence ?? 0.9,
    aiRawResponse: content,
    noteReference:
      notesBlock && typeof parsed.noteReference === "string"
        ? parsed.noteReference.trim() || undefined
        : undefined,
  };
}
