/**
 * Dashboard assistant: recognise "what is the HS code for X" style questions,
 * find the product named in them, and format the reply from a real
 * classification result. Pure module (no database), testable offline.
 */

import { isCatchAllHsCode } from "../hs-catch-all";
import type { SuggestionReview } from "../import-cases/hs-web-step";

export type HsChatParse = {
  /** The message is asking for an HS code / classification. */
  intent: boolean;
  /** The product the user named (or null when they did not name one). */
  product: string | null;
  /** True when the product was matched to one of the open case's products. */
  fromCase: boolean;
};

const INTENT_RE =
  /\bhs\b|\bh\.s\.?\b|\bhs[-\s]?codes?\b|\bharmoni[sz]ed\b|\btariff\b|\bclassif(?:y|ies|ied|ication|ications)\b|\b(?:what|which|right|correct)\s+(?:hs\s+)?code\b|\bcode\s+(?:for|of)\b|\bheading\s+(?:for|of)\b/i;

const GENERIC_PRODUCTS = new Set([
  "this",
  "that",
  "it",
  "them",
  "these",
  "those",
  "product",
  "products",
  "item",
  "items",
  "this product",
  "that product",
  "this item",
  "that item",
  "my product",
  "my products",
  "the product",
  "the products",
  "the item",
  "the items",
  "something",
  "an item",
  "a product",
  "hs code",
  "the hs code",
  "an hs code",
  "a code",
  "hs",
]);

function cleanProduct(value: string): string | null {
  const v = value
    .replace(/[?!.]+$/g, "")
    .replace(/\b(?:please|pls|thanks|thank you)\b.*$/i, "")
    .replace(/\b(?:in|for|to)\s+(?:ethiopia|ethiopian customs|import|importing)\b.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^["'\u201c\u2018]+|["'\u201d\u2019]+$/g, "")
    .replace(/^(?:the|a|an|my)\s+/i, "")
    .replace(/\s+(?:product|item)$/i, (m, offset, str) =>
      str.slice(0, offset).trim().length >= 3 ? "" : m,
    )
    .trim();
  if (v.length < 3 || v.length > 200) return null;
  if (GENERIC_PRODUCTS.has(v.toLowerCase())) return null;
  return v;
}

/**
 * @param knownProducts descriptions of the products in the open import case
 */
export function parseHsChatQuestion(
  text: string,
  knownProducts: string[] = [],
): HsChatParse {
  const message = text.trim();
  if (!INTENT_RE.test(message)) {
    return { intent: false, product: null, fromCase: false };
  }

  // 1. a product of the open case named in the message (longest name wins)
  const lower = message.toLowerCase();
  const known = [...new Set(knownProducts.map((p) => p.trim()).filter((p) => p.length >= 4))]
    .filter((p) => lower.includes(p.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];
  if (known) return { intent: true, product: known, fromCase: true };

  // 2. quoted text
  const quoted = message.match(/["\u201c]([^"\u201d]{3,}?)["\u201d]/)?.[1];
  const quotedClean = quoted ? cleanProduct(quoted) : null;
  if (quotedClean) return matchKnown(quotedClean, knownProducts);

  // 3. "... code for/of/on X", "classify X", "tariff for X"
  const patterns = [
    /\b(?:hs\s*codes?|harmoni[sz]ed(?:\s+codes?)?|tariff(?:\s+codes?)?|codes?|heading|classification)\s+(?:for|of|on|to)\s+(.+)$/i,
    /\bclassif(?:y|ies)\s+(?:the\s+|a\s+|an\s+|my\s+)?(.+)$/i,
    /\b(?:find|get|give\s+me|tell\s+me|need|search)\s+(?:me\s+)?(?:the\s+)?(?:hs|tariff)\s*codes?\s+(?:for\s+)?(.+)$/i,
  ];
  for (const re of patterns) {
    const m = message.match(re)?.[1];
    const clean = m ? cleanProduct(m) : null;
    if (clean) return matchKnown(clean, knownProducts);
  }

  // 4. "<product> hs code?"
  const trailing = message.match(/^(.+?)\s+(?:hs\s*code|tariff(?:\s+code)?)\??$/i)?.[1];
  let trailingText = `${trailing ?? ""} `;
  for (;;) {
    const next = trailingText.replace(
      /^(?:what(?:'s|\s+is)?|which|whats|the|is|are|its?|can\s+you|could\s+you|tell\s+me|give\s+me|me)\s+/i,
      "",
    );
    if (next === trailingText) break;
    trailingText = next;
  }
  const trailingClean = trailingText.trim() ? cleanProduct(trailingText.trim()) : null;
  if (trailingClean) return matchKnown(trailingClean, knownProducts);

  // No product named. Only treat it as "ask for a code" when it really asks for
  // one; general questions ("how does classification work?") go to normal chat.
  const asksForCode =
    /\b(?:what|which|find|get|give|tell|need|look\s*up|search|show)\b[^.?!]*\b(?:hs\s*)?codes?\b|\bclassify\b/i.test(
      message,
    );
  return { intent: asksForCode, product: null, fromCase: false };
}

function matchKnown(candidate: string, knownProducts: string[]): HsChatParse {
  const c = candidate.toLowerCase();
  const hit = knownProducts.find((p) => {
    const k = p.trim().toLowerCase();
    return k.length >= 4 && (k.includes(c) || c.includes(k));
  });
  return hit
    ? { intent: true, product: hit.trim(), fromCase: true }
    : { intent: true, product: candidate, fromCase: false };
}

export type ChatClassification = {
  isImportItem: boolean;
  hsCode: string;
  category: string;
  cleanDescription: string;
  confidence?: number;
  source: string;
  review?: SuggestionReview;
};

/** Reply when the user asked for a code but named no product. */
export function formatAskWhichProduct(knownProducts: string[]): string {
  const sample = knownProducts.slice(0, 5);
  const list = sample.length
    ? `\n\nProducts in this case include:\n${sample.map((p) => `- ${p}`).join("\n")}`
    : "";
  return `Which product do you want the HS code for? Tell me the product name or description (for example: "Electrolyte Water" or "Palm olein RBD oil, bulk").${list}`;
}

function sourceLabel(source: string, webUsed: boolean): string {
  if (source === "reference_match") return "tariff book match";
  if (source === "rule_fallback") return "rule fallback (AI was not available)";
  return webUsed ? "AI with web search" : "AI";
}

/** Build the chat answer from a real classification result. */
export function formatHsChatReply(
  description: string,
  result: ChatClassification,
): string {
  if (!result.isImportItem || result.hsCode === "EXCLUDE") {
    return `I could not classify "${description}" as an import product. Try a clearer product description (for example "Palm olein RBD oil bulk").`;
  }

  const review = result.review;
  const web = review?.web;
  const lines: string[] = [];
  const name = result.cleanDescription || description;

  const catchAll = isCatchAllHsCode(result.hsCode);
  const hasOptions = (review?.alternatives.length ?? 0) > 0;
  const showsDecision = catchAll && (hasOptions || Boolean(review?.question));
  if (showsDecision) {
    lines.push(
      `I can't pin down "${name}" with confidence yet, so I won't guess a single code.`,
    );
    if (review && hasOptions) {
      lines.push(
        `Most likely options (best first):\n${review.alternatives
          .slice(0, 3)
          .map(
            (a, i) =>
              `${i + 1}. ${a.hsCode}${a.officialDescription ? ` - ${a.officialDescription}` : ""}${a.reason ? ` (${a.reason})` : ""}`,
          )
          .join("\n")}`,
      );
    }
    if (review?.question) {
      lines.push(`One question would settle it: ${review.question}`);
    }
    lines.push(
      "Tell me the answer, or add a note on the product's row (Classification tab) and press Ask AI again, and I'll narrow it down.",
    );
  } else if (catchAll) {
    lines.push(`I could not find a confident HS code for "${name}".`);
    lines.push(`Needs review: ${review?.reason ?? "No clear tariff match."}`);
    if (review?.proposedCode) {
      lines.push(
        `A code I could not verify: ${review.proposedCode.hsCode} (${review.proposedCode.note ?? "not in the tariff book"}).`,
      );
    }
  } else {
    const conf =
      result.confidence != null ? ` (confidence ${Math.round(result.confidence * 100)}%)` : "";
    lines.push(`Suggested HS code for "${name}": **${result.hsCode}**${conf}`);
    lines.push(`Category: ${result.category}`);
    lines.push(`Source: ${sourceLabel(result.source, web?.used === true)}`);
    if (review?.required && review.reason) {
      lines.push(`Needs review: ${review.reason}`);
    }
  }

  if (web?.reasoning) lines.push(`Why: ${web.reasoning}`);

  if (web?.sources.length) {
    lines.push(
      `Sources:\n${web.sources
        .slice(0, 4)
        .map((s) => `- ${s.title ? `${s.title}: ` : ""}${s.url}`)
        .join("\n")}`,
    );
  } else if (web?.attempted && web.error) {
    lines.push("Web search was not available, so this answer has no web sources.");
  }

  if (review?.previous) {
    lines.push(`Earlier suggestion: ${review.previous.hsCode}`);
  }
  if (review?.alternatives.length && !showsDecision) {
    lines.push(
      `Other possible codes:\n${review.alternatives
        .slice(0, 3)
        .map(
          (a) =>
            `- ${a.hsCode}${a.officialDescription ? ` - ${a.officialDescription}` : ""}`,
        )
        .join("\n")}`,
    );
  }

  if (review?.question && !catchAll) {
    lines.push(`One question would settle it: ${review.question}`);
  }
  lines.push(
    "This is only a suggestion. A person must approve the HS code on the case's Classification tab before it is used.",
  );
  return lines.join("\n\n");
}