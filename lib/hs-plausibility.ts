/**
 * Does an HS code fit the product? A plausibility check on the HS chapter and
 * section, used as a gate before a tariff-book / AI code is accepted and to find
 * codes that were accepted before.
 *
 * The product kind comes from whole words in the description (see
 * hsProductChapter.ts). The supplier's own HS code from the invoice is only a
 * HINT: when its chapter differs the code is flagged "check", never rejected
 * because of it alone.
 *
 * Pure module: no database, no server-only imports.
 */
import { preferredChapters, productFamily, type ProductFamily } from "./hsProductChapter";
import { hsDigits } from "./hs-code-format";
import { isPlaceholderHsCode } from "./hs-catch-all";

/** HS sections (I-XXI): chapter range and a short title. */
const SECTIONS: Array<{ id: string; from: number; to: number; title: string }> = [
  { id: "I", from: 1, to: 5, title: "Live animals and animal products" },
  { id: "II", from: 6, to: 14, title: "Vegetable products" },
  { id: "III", from: 15, to: 15, title: "Fats and oils" },
  { id: "IV", from: 16, to: 24, title: "Prepared foodstuffs, drinks and tobacco" },
  { id: "V", from: 25, to: 27, title: "Mineral products" },
  { id: "VI", from: 28, to: 38, title: "Chemical products" },
  { id: "VII", from: 39, to: 40, title: "Plastics and rubber" },
  { id: "VIII", from: 41, to: 43, title: "Hides, leather and furskins" },
  { id: "IX", from: 44, to: 46, title: "Wood and cork" },
  { id: "X", from: 47, to: 49, title: "Paper and printed matter" },
  { id: "XI", from: 50, to: 63, title: "Textiles" },
  { id: "XII", from: 64, to: 67, title: "Footwear, headgear and umbrellas" },
  { id: "XIII", from: 68, to: 70, title: "Stone, ceramic and glass" },
  { id: "XIV", from: 71, to: 71, title: "Pearls, precious stones and metals" },
  { id: "XV", from: 72, to: 83, title: "Base metals and articles of base metal" },
  { id: "XVI", from: 84, to: 85, title: "Machinery and electrical equipment" },
  { id: "XVII", from: 86, to: 89, title: "Vehicles, aircraft and vessels" },
  { id: "XVIII", from: 90, to: 92, title: "Instruments, clocks and musical instruments" },
  { id: "XIX", from: 93, to: 93, title: "Arms and ammunition" },
  { id: "XX", from: 94, to: 96, title: "Furniture, toys and miscellaneous articles" },
  { id: "XXI", from: 97, to: 97, title: "Works of art and antiques" },
];

export function chapterOfCode(code: string | null | undefined): string | null {
  const d = hsDigits(code);
  if (d.length < 2) return null;
  const n = Number.parseInt(d.slice(0, 2), 10);
  return n >= 1 && n <= 97 ? d.slice(0, 2) : null;
}

export function sectionOfChapter(
  chapter: string | null | undefined,
): { id: string; title: string } | null {
  const n = Number.parseInt(chapter ?? "", 10);
  const s = SECTIONS.find((x) => n >= x.from && n <= x.to);
  return s ? { id: s.id, title: s.title } : null;
}

function chapterText(chapter: string): string {
  const s = sectionOfChapter(chapter);
  return s ? `chapter ${chapter} (${s.title})` : `chapter ${chapter}`;
}

/**
 * The product NAME out of a long clean description: "Cumin powder, a spice made
 * from ground cumin seeds ..." becomes "Cumin powder". The tariff book is matched
 * on the name, not on the explanation words around it.
 */
export function shortProductLabel(text: string | null | undefined): string {
  const original = (text ?? "").replace(/\s+/g, " ").trim();
  if (!original) return "";
  const cut = original.search(
    /,\s+(?:a|an|the|made|used|which|that)\s|\s+(?:is|are)\s+(?:a|an|the)\s|:\s|\s+-\s|\s*\(|;|\.\s/i,
  );
  const label = (cut > 2 ? original.slice(0, cut) : original).trim();
  return label.slice(0, 80).trim() || original.slice(0, 80);
}

/** Header names that hold the supplier's HS code in an invoice / packing sheet. */
const SUPPLIER_HS_KEY_RE = /^\s*(?:h\.?\s?s\.?|hts|hsn|tariff|customs|commodity)[\s._-]*(?:code|no\.?|number)?\s*$/i;

/**
 * The supplier's HS code from the `extra` columns of invoice / packing lines
 * (for example a column called "HS code"). Returns its digits (4-10) or null.
 * It is a hint, not a fact.
 */
export function extractSupplierHsCode(
  extras: ReadonlyArray<Record<string, unknown> | null | undefined>,
): string | null {
  for (const extra of extras) {
    if (!extra || typeof extra !== "object") continue;
    for (const [key, value] of Object.entries(extra)) {
      if (!SUPPLIER_HS_KEY_RE.test(key)) continue;
      const digits = hsDigits(typeof value === "string" || typeof value === "number" ? String(value) : "");
      if (digits.length >= 4 && chapterOfCode(digits)) return digits;
    }
  }
  return null;
}

export type PlausibilityStatus = "ok" | "check" | "implausible" | "unknown";

export type PlausibilityVerdict = {
  status: PlausibilityStatus;
  /** Plain-language reasons (empty when ok / unknown). */
  reasons: string[];
  /** Kind of product the description names, e.g. "food and drink". */
  family: string | null;
  /** Chapters that fit that kind of product. */
  expectedChapters: string[] | null;
  /** Chapter of the checked code. */
  chapter: string | null;
  /** Supplier's HS code (digits) used as a hint. */
  supplierHsCode: string | null;
  /**
   * How far the suggestion and the supplier's code disagree (only when status is
   * "check"): a different chapter, a different heading (same chapter) or a
   * different sub-heading (same heading).
   */
  level?: "chapter" | "heading" | "subheading";
  /**
   * The exact word or phrase of the description that raised a product-kind
   * warning ("pot"). Set only when the warning comes from the words of the name.
   */
  trigger?: string;
};

export type PlausibilityInput = {
  hsCode: string | null | undefined;
  /**
   * Texts that name the product, best first (product name, original wording,
   * clean description). The first text that names a kind of product decides.
   */
  texts: ReadonlyArray<string | null | undefined>;
  supplierHsCode?: string | null;
  /**
   * True when the product description clearly supports the suggestion over the
   * supplier's code (the caller compared both tariff rows). A heading or
   * sub-heading difference is then not flagged.
   */
  descriptionSupportsSuggestion?: boolean;
  /**
   * A person chose this code (typed it or picked it from the shown options):
   * the supplier's hint no longer flags it. An implausible code is still flagged.
   */
  decidedByHuman?: boolean;
  /**
   * A quick AI check already looked at the whole description and said this code
   * fits: a keyword warning is dropped.
   */
  keywordClearedByAi?: boolean;
};

/**
 * One plain sentence for a keyword warning: which word was seen, what it usually
 * means, where the code sits, and that it is only a warning.
 */
export function keywordWarningText(input: {
  trigger?: string;
  familyLabel: string;
  allowed: string[];
  chapter: string;
  preferred?: string[];
}): string {
  const where = (input.preferred?.length ? input.preferred : input.allowed).slice(0, 4).join(", ");
  const word = input.trigger ? `We saw "${input.trigger}" in the name, which usually means` : "The name looks like";
  return `${word} ${input.familyLabel} (chapter ${where}). This code is in ${chapterText(input.chapter)}. This is only a warning from a word check, not a decision.`;
}

function dotted(digits: string): string {
  return digits.length >= 8 ? `${digits.slice(0, 4)}.${digits.slice(4, 8)}` : digits;
}

/**
 * Compares the suggestion with the supplier's code inside one chapter.
 * "heading": different 4-digit heading; "subheading": same heading, different
 * 6 or 8 digits (only when both codes are specific enough to compare).
 */
function sameChapterDifference(
  code: string,
  supplier: string,
): "heading" | "subheading" | null {
  if (code.length < 4 || supplier.length < 4) return null;
  if (code.slice(0, 4) !== supplier.slice(0, 4)) return "heading";
  const n = Math.min(code.length, supplier.length, 8);
  if (n < 6) return null; // the supplier only gave the heading: nothing to compare
  return code.slice(0, n) === supplier.slice(0, n) ? null : "subheading";
}

function familyOfTexts(
  texts: PlausibilityInput["texts"],
): { fam: ProductFamily; text: string } | null {
  for (const t of texts) {
    const text = (t ?? "").trim();
    if (!text) continue;
    const fam = productFamily(text);
    if (fam) return { fam, text };
  }
  return null;
}

/**
 * Food chapters that a specific food word (tea, sauce, rice ...) almost never
 * sits in: fats and oils, animal feed, tobacco. Tea in "1503" (lard stearin)
 * is the typical wrong pick. Only used when the words point to other chapters.
 */
const ODD_FOOD_CHAPTERS = new Set(["15", "23", "24"]);

export function checkPlausibility(input: PlausibilityInput): PlausibilityVerdict {
  const chapter = isPlaceholderHsCode(input.hsCode) ? null : chapterOfCode(input.hsCode);
  const supplierDigits = input.supplierHsCode ? hsDigits(input.supplierHsCode) : "";
  const supplierChapter = supplierDigits.length >= 4 ? chapterOfCode(supplierDigits) : null;
  const found = familyOfTexts(input.texts);
  const fam = found?.fam ?? null;

  const base = {
    family: fam?.label ?? null,
    expectedChapters: fam?.allowed ?? null,
    chapter,
    supplierHsCode: supplierChapter ? supplierDigits : null,
  };

  if (!chapter) return { ...base, status: "unknown", reasons: [] };

  const reasons: string[] = [];
  let status: PlausibilityStatus = "ok";
  let trigger: string | undefined;

  if (fam && !fam.allowed.includes(chapter)) {
    status = "implausible";
    trigger = fam.trigger;
    reasons.push(
      keywordWarningText({ trigger, familyLabel: fam.label, allowed: fam.allowed, chapter }),
    );
  }

  if (status === "ok" && fam?.id === "food" && ODD_FOOD_CHAPTERS.has(chapter)) {
    const preferred = preferredChapters(found!.text);
    if (preferred.length > 0 && !preferred.includes(chapter)) {
      status = "implausible";
      trigger = fam.trigger;
      reasons.push(
        keywordWarningText({ trigger, familyLabel: fam.label, allowed: fam.allowed, chapter, preferred }),
      );
    }
  }

  // The AI already looked at the full description and said the code fits.
  if (status === "implausible" && input.keywordClearedByAi) {
    status = "ok";
    trigger = undefined;
    reasons.length = 0;
  }

  let level: PlausibilityVerdict["level"];
  if (supplierChapter && supplierChapter !== chapter) {
    if (status === "ok") status = "check";
    level = "chapter";
    reasons.push(
      `The supplier's invoice code is ${dotted(supplierDigits)} (${chapterText(supplierChapter)}), which is a different chapter.`,
    );
  } else if (supplierChapter && !input.descriptionSupportsSuggestion) {
    const codeDigits = hsDigits(input.hsCode);
    const diff = sameChapterDifference(codeDigits, supplierDigits);
    if (diff) {
      if (status === "ok") status = "check";
      level = diff;
      reasons.push(
        diff === "heading"
          ? `The supplier's invoice code is ${dotted(supplierDigits)} (heading ${supplierDigits.slice(0, 4)}), this code is in heading ${codeDigits.slice(0, 4)}: same chapter, different heading.`
          : `The supplier's invoice code is ${dotted(supplierDigits)}, this code is ${dotted(codeDigits)}: same heading ${codeDigits.slice(0, 4)}, different sub-heading.`,
      );
    }
  }

  // A person already chose between the options: the hint is not raised again.
  if (input.decidedByHuman && status === "check") {
    return { ...base, status: "ok", reasons: [] };
  }

  return {
    ...base,
    status,
    reasons,
    ...(level ? { level } : {}),
    ...(trigger ? { trigger } : {}),
  };
}

/** True when the verdict should stop a code being accepted without a person looking. */
export function needsRecheck(verdict: PlausibilityVerdict): boolean {
  return verdict.status === "implausible" || verdict.status === "check";
}

/**
 * A word check alone never blocks a person who looks at the item and approves
 * it: it is a warning. Only a bulk approve (nobody looks at each item) stops on it.
 */
export function blocksApproval(
  verdict: PlausibilityVerdict,
  options?: { bulk?: boolean },
): boolean {
  return options?.bulk === true && verdict.status === "implausible";
}