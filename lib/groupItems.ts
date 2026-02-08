import {
  isExcludedHsCode,
  isNonItemCategory,
  UNKNOWN_HS,
  validateClassification,
} from "./allowedHsCodes";

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
export function groupItemsByHsCode(
  items: ItemWithClassification[]
): GroupedItem[] {
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

    const validated = validateClassification({
      hsCode: item.aiHsCode,
      category: item.aiCategory,
    });
    if (validated.status === "exclude") continue;
    const hsNormalized =
      validated.hsCode === "9999.00" ||
      validated.hsCode === "9999.99" ||
      validated.hsCode?.startsWith("9999.")
        ? UNKNOWN_HS
        : validated.hsCode;
    const category = item.aiCategory || "Unclassified";
    const desc =
      item.cleanDescription || item.detectedDescription || item.rawLine || "";
    const qty = Number(item.detectedQuantity) || 1;
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
        .map((d) => (d != null ? String(d).trim() : ""))
        .filter(Boolean)
    ),
  ];
  if (unique.length === 1) return unique[0];
  return (
    unique.slice(0, 3).join("; ") + (unique.length > 3 ? " (and others)" : "")
  );
}
