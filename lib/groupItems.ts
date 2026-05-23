import {
  isExcludedHsCode,
  isNonItemCategory,
  NEED_INFO_HS,
  UNKNOWN_HS,
  validateClassification,
  type ValidationMode,
} from "./allowedHsCodes";
import { isHsCodeFormat } from "./hsCodeUtils";
import {
  cleanProductDescription,
  isNonItemLine,
  normalizeLineQuantity,
} from "./packingListFilters";

export interface ItemWithClassification {
  id: string;
  rawLine: string;
  detectedDescription: string | null;
  detectedQuantity: number | null;
  detectedUnit: string | null;
  aiCategory: string | null;
  aiHsCode: string | null;
  cleanDescription: string | null;
}

export interface GroupedItem {
  hsCode: string;
  category: string;
  finalDescription: string;
  totalQuantity: number;
  unit: string | null;
}

/**
 * Group items by HS code: sum quantities, merge descriptions.
 */
function validationModeForItems(
  items: ItemWithClassification[]
): ValidationMode {
  const coded = items.filter((i) => isHsCodeFormat(i.aiHsCode)).length;
  return coded >= items.length * 0.4 ? "document" : "ai";
}

export function groupItemsByHsCode(
  items: ItemWithClassification[]
): GroupedItem[] {
  const validationMode = validationModeForItems(items);
  const byHs: Record<
    string,
    {
      category: string;
      descriptions: string[];
      totalQty: number;
      unit: string | null;
    }
  > = {};

  for (const item of items) {
    if (isNonItemCategory(item.aiCategory)) continue;
    if (isExcludedHsCode(item.aiHsCode)) continue;
    if (item.aiHsCode === NEED_INFO_HS) continue;

    const desc =
      item.cleanDescription || item.detectedDescription || item.rawLine || "";
    if (isNonItemLine(desc, item.rawLine)) continue;

    const validated = validateClassification({
      hsCode: item.aiHsCode,
      category: item.aiCategory,
      mode: validationMode,
    });
    if (validated.status === "exclude") continue;
    const hsNormalized =
      validationMode === "ai" &&
      (validated.hsCode === "9999.00" ||
        validated.hsCode === "9999.99" ||
        validated.hsCode?.startsWith("9999."))
        ? UNKNOWN_HS
        : validated.hsCode;
    const category = item.aiCategory || "Unclassified";
    const qty = normalizeLineQuantity(item.detectedQuantity) ?? 1;
    const unit = item.detectedUnit ?? null;

    if (!byHs[hsNormalized]) {
      byHs[hsNormalized] = { category, descriptions: [], totalQty: 0, unit };
    }
    byHs[hsNormalized].descriptions.push(desc);
    byHs[hsNormalized].totalQty += qty;
    if (unit) byHs[hsNormalized].unit = unit;
  }

  return Object.entries(byHs).map(([hsCode, g]) => ({
    hsCode,
    category: g.category,
    finalDescription: mergeDescriptions(g.descriptions),
    totalQuantity: g.totalQty,
    unit: g.unit,
  }));
}

function mergeDescriptions(descriptions: string[]): string {
  const unique = [
    ...new Set(
      descriptions
        .map((d) =>
          d != null ? cleanProductDescription(String(d)) : ""
        )
        .filter(Boolean)
    ),
  ];
  if (unique.length === 1) return unique[0];
  if (unique.length <= 5) return unique.join("; ");
  return `${unique.slice(0, 4).join("; ")} (+${unique.length - 4} more)`;
}
