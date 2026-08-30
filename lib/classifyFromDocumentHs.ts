import { applyAssessorRules } from "./assessorRules";
import { categoryFromHs } from "./hsCategories";
import { type DocumentClassificationMeta } from "./documentClassificationMeta";
import { chapterCompatibilityReasons } from "./hsProductChapter";
import { findInCacheSync } from "./hsReferenceCache";
import { cleanProductDescription } from "./packingListFilters";
import { normalizeHsCode, type NormalizedHs } from "./hsCodeUtils";
import type { ClassificationResult } from "./classifyItem";

/** Description vs chapter sanity checks (flag when document HS conflicts with product type). */
function sanityCheck(
  description: string,
  hs: NormalizedHs,
): { ok: boolean; reasons: string[] } {
  const reasons = chapterCompatibilityReasons(description, hs.chapter);

  const d = description.toLowerCase();
  const ch = hs.chapter;

  const expectChapter = (pattern: RegExp, expected: string, label: string) => {
    if (pattern.test(d) && ch !== expected) {
      reasons.push(
        `${label}: description suggests chapter ${expected}, document has ${ch}`,
      );
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
  if (
    /copper\s*coil\s*motor|motor\s*with\s*power\s*cord/i.test(d) &&
    hs.heading === "8471"
  ) {
    reasons.push("Fan motor fragment should not use HS 8471 (computers)");
  }

  return { ok: reasons.length === 0, reasons };
}

export function classifyFromDocumentHs(
  description: string,
  sourceHsRaw: string,
  options?: { unit?: string },
): ClassificationResult & { aiRawResponse: string } {
  const normalized = normalizeHsCode(sourceHsRaw);
  if (!normalized) {
    throw new Error(`Invalid document HS code: ${sourceHsRaw}`);
  }

  const desc = cleanProductDescription(description);
  let category = categoryFromHs(normalized, desc);
  const sanity = sanityCheck(desc, normalized);

  const hsCode = normalized.display;
  const ref = findInCacheSync(sourceHsRaw) ?? findInCacheSync(hsCode);

  let cleanDescription = desc;
  if (ref) {
    const official = ref.description.replace(/^[-\s]+/, "").trim();
    if (official && (desc.length < 12 || desc.toLowerCase() === "unspecified item")) {
      cleanDescription = official;
    }
    if (ref.chapter) {
      category = categoryFromHs(normalized, cleanDescription);
    }
  }

  let result: ClassificationResult = {
    isImportItem: true,
    category,
    hsCode,
    cleanDescription,
    confidence: sanity.ok ? 0.98 : 0.82,
  };

  const beforeHs = result.hsCode;
  result = applyAssessorRules(desc, result);
  const assessorOverride = result.hsCode !== beforeHs;

  const meta: DocumentClassificationMeta = {
    source: "document",
    documentHs: sourceHsRaw.trim(),
    normalizedHs: hsCode,
    reviewRecommended: !sanity.ok && !assessorOverride,
    reviewReasons: sanity.reasons,
    tariffNo: ref?.tariffNo,
    dutyRate: ref?.dutyRate ?? undefined,
    stdUnit: ref?.stdUnit ?? options?.unit ?? undefined,
    referenceDescription: ref?.description,
  };

  if (assessorOverride) {
    meta.reviewReasons = [
      ...meta.reviewReasons,
      `assessor override: ${beforeHs} → ${result.hsCode}`,
    ];
  }

  return {
    ...result,
    hsCode: result.hsCode,
    category: result.category,
    confidence: meta.reviewRecommended ? 0.82 : 0.98,
    aiRawResponse: JSON.stringify(meta),
  };
}
