/**
 * Assessor-style rule layer: apply HS rulebook overrides after AI classification.
 * Fixes legal mistakes where AI classified by "meaning" instead of HS chapter.
 */

import type { ClassificationResult } from "./classifyItem";
import { NEED_INFO_HS } from "./allowedHsCodes";

/** Re-export for callers that need it. */
export { NEED_INFO_HS };

/** Category shown when description is too vague to classify. */
export const NEED_INFO_CATEGORY = "Need more description";

// ---- Force rules: description pattern → correct HS (assessor rulebook) ----
const FORCE_RULES: Array<{
  match: (desc: string) => boolean;
  hsCode: string;
  category: string;
}> = [
  // Sculpture / statuary → 9703 (artwork), never 6702 (artificial plants)
  {
    match: (d) => /sculpture|statuary|statue\b/i.test(d),
    hsCode: "9703",
    category: "Sculptures and statuary",
  },
  // Wallpaper / wall coverings → 4814, never 9404 (bedding)
  {
    match: (d) => /wallpaper|wall\s*covering|wall\s*paper/i.test(d),
    hsCode: "4814",
    category: "Wallpaper and wall coverings",
  },
  // Ceramic vase / ceramic vessel → always 6913
  {
    match: (d) =>
      /ceramic\s*vase|vase\s*\(?\s*ceramic|ceramic\s*vessel|pottery\s*vase/i.test(
        d
      ),
    hsCode: "6913",
    category: "Decorative ceramics",
  },
  // "Decorative fountain" → 3926 (plastic/decorative article); check before generic fountain
  {
    match: (d) => /decorative\s*fountain|fountain\s*\(?\s*decor/i.test(d),
    hsCode: "3926",
    category: "Plastic articles",
  },
  // Fountain (water feature / pump) → 8413
  {
    match: (d) => /fountain\b/i.test(d),
    hsCode: "8413",
    category: "Pumps for liquids",
  },
];

// ---- Vague descriptions: assessor would not classify; flag for "Need more info" ----
const VAGUE_PATTERNS: Array<RegExp | ((d: string) => boolean)> = [
  /^decorative\s+item\s*$/i,
  /^decor\s*item\s*$/i,
  /^decorative\s+item\s+with\s+pattern\s*$/i,
  /^misc(ellaneous)?\s*decor\s*$/i,
  /^item\s+with\s+pattern\s*$/i,
  /^general\s+decor\s*$/i,
  /^assorted\s+decor\s*$/i,
  /^decorative\s+piece\s*$/i,
  (d) => d.trim().length > 0 && /^decorative\s+item\.?$/i.test(d.trim()),
];

function isVagueDescription(description: string): boolean {
  const normalized = description.trim();
  if (normalized.length < 10) return false; // very short might be valid
  return VAGUE_PATTERNS.some((p) =>
    typeof p === "function" ? p(normalized) : p.test(normalized)
  );
}

// ---- 9999 fallbacks: when AI used "unclassified" but we can assign from rulebook ----
const FALLBACK_9999_RULES: Array<{
  match: (desc: string) => boolean;
  hsCode: string;
  category: string;
}> = [
  {
    match: (d) => /decorative\s*fountain|fountain\s*\(?\s*decor/i.test(d),
    hsCode: "3926",
    category: "Plastic articles",
  },
  {
    match: (d) => /fountain\b/i.test(d),
    hsCode: "8413",
    category: "Pumps for liquids",
  },
];

/**
 * Apply assessor rules on top of AI result.
 * Order: 1) Force rules (keyword → correct HS), 2) Vague → NEED_INFO, 3) 9999 fallbacks.
 */
export function applyAssessorRules(
  description: string,
  result: ClassificationResult
): ClassificationResult {
  const raw = description.trim();
  const desc = result.cleanDescription?.trim() || raw;
  const combined = [raw, desc].filter(Boolean).join(" ");

  // 1) Force rules: override wrong AI choices (e.g. sculpture→6702, wallpaper→9404)
  for (const rule of FORCE_RULES) {
    if (rule.match(combined)) {
      return {
        ...result,
        hsCode: rule.hsCode,
        category: rule.category,
        cleanDescription: result.cleanDescription || description,
      };
    }
  }

  // 2) Vague description: do not guess; flag for human review
  if (isVagueDescription(combined)) {
    return {
      ...result,
      isImportItem: true, // still an item, but needs more info
      hsCode: NEED_INFO_HS,
      category: NEED_INFO_CATEGORY,
      cleanDescription: result.cleanDescription || description,
    };
  }

  // 3) AI returned 9999 (unclassified): try rulebook fallbacks so we avoid lazy 9999
  const is9999 =
    result.hsCode === "9999" ||
    result.hsCode?.startsWith("9999.") ||
    result.hsCode === "9999.00";
  if (is9999) {
    for (const rule of FALLBACK_9999_RULES) {
      if (rule.match(combined)) {
        return {
          ...result,
          hsCode: rule.hsCode,
          category: rule.category,
          cleanDescription: result.cleanDescription || description,
        };
      }
    }
  }

  // 4) Fix common AI mistake: ceramic vase classified as 6702 → force 6913
  if (
    result.hsCode === "6702" &&
    /vase|vessel|pottery|ceramic/i.test(combined)
  ) {
    return {
      ...result,
      hsCode: "6913",
      category: "Decorative ceramics",
      cleanDescription: result.cleanDescription || description,
    };
  }

  return result;
}

/**
 * Classify using only rulebook (no AI). Use when API fails so we still get correct HS codes.
 */
export function classifyByRulesOnly(description: string): {
  hsCode: string;
  category: string;
  cleanDescription: string;
} {
  const fake: ClassificationResult = {
    isImportItem: true,
    hsCode: "9999",
    category: "Unclassified",
    cleanDescription: description.trim(),
  };
  const out = applyAssessorRules(description.trim(), fake);
  return {
    hsCode: out.hsCode ?? "9999",
    category: out.category ?? "Unclassified",
    cleanDescription: out.cleanDescription ?? description.trim(),
  };
}
