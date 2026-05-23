import { categoryFromHs } from "./hsCategories";
import { cleanProductDescription } from "./packingListFilters";
import { normalizeHsCode, type NormalizedHs } from "./hsCodeUtils";
import type { ClassificationResult } from "./classifyItem";

export type DocumentClassificationMeta = {
  source: "document";
  documentHs: string;
  normalizedHs: string;
  reviewRecommended: boolean;
  reviewReasons: string[];
};

/** Description vs chapter sanity checks (flag only — document HS is kept). */
function sanityCheck(
  description: string,
  hs: NormalizedHs
): { ok: boolean; reasons: string[] } {
  const d = description.toLowerCase();
  const reasons: string[] = [];
  const ch = hs.chapter;

  const expectChapter = (pattern: RegExp, expected: string, label: string) => {
    if (pattern.test(d) && ch !== expected) {
      reasons.push(`${label}: description suggests chapter ${expected}, document has ${ch}`);
    }
  };

  expectChapter(/noodle|pasta|rice\b|cereal/i, "19", "Food");
  expectChapter(/juice|beverage|drink|water\b/i, "20", "Beverage");
  expectChapter(/juice|beverage|drink/i, "22", "Beverage");
  expectChapter(/sausage|sauce|vinegar|soup|snack/i, "21", "Food prep");
  expectChapter(/towel|textile|briefs|underwear/i, "63", "Textile");
  expectChapter(/towel/i, "96", "Textile");
  expectChapter(/scissor|knife|spoon|cutlery/i, "82", "Cutlery");
  expectChapter(/soy\s*milk|kettle|oven|fryer|steamer|air\s*fryer/i, "85", "Electrical");
  expectChapter(/plate|bowl|ceramic|cup\b/i, "69", "Ceramic");
  expectChapter(/wooden\s*frame|wood\b/i, "44", "Wood");
  expectChapter(/lamp|light\b/i, "94", "Lighting");

  if (/towel/i.test(d) && hs.heading === "4814") {
    reasons.push("Towel should not use HS 4814 (wallpaper)");
  }
  if (/soy\s*milk|milk\s*maker/i.test(d) && hs.heading === "8471") {
    reasons.push("Soy milk maker should not use HS 8471 (computers)");
  }

  return { ok: reasons.length === 0, reasons };
}

export function classifyFromDocumentHs(
  description: string,
  sourceHsRaw: string,
  options?: { unit?: string }
): ClassificationResult & { aiRawResponse: string } {
  const normalized = normalizeHsCode(sourceHsRaw);
  if (!normalized) {
    throw new Error(`Invalid document HS code: ${sourceHsRaw}`);
  }

  const desc = cleanProductDescription(description);
  let category = categoryFromHs(normalized, desc);
  const sanity = sanityCheck(desc, normalized);

  const hsCode = normalized.display;
  const result: ClassificationResult = {
    isImportItem: true,
    category,
    hsCode,
    cleanDescription: desc,
    confidence: sanity.ok ? 0.98 : 0.82,
  };

  const meta: DocumentClassificationMeta = {
    source: "document",
    documentHs: sourceHsRaw.trim(),
    normalizedHs: hsCode,
    reviewRecommended: !sanity.ok,
    reviewReasons: sanity.reasons,
  };

  return {
    ...result,
    hsCode,
    category,
    confidence: meta.reviewRecommended ? 0.82 : 0.98,
    aiRawResponse: JSON.stringify(meta),
  };
}

export function parseDocumentClassificationMeta(
  raw: string | null | undefined
): DocumentClassificationMeta | null {
  if (!raw?.trim()) return null;
  try {
    const p = JSON.parse(raw) as DocumentClassificationMeta;
    if (p.source === "document") return p;
  } catch {
    return null;
  }
  return null;
}
