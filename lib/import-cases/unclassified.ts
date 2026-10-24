/**
 * Products that are NOT in any declaration group, so the export never drops a
 * product silently. Pure (no DB): the caller passes what is stored.
 */

import { isPlaceholderHsCode } from "@/lib/hs-catch-all";

export type UnclassifiedProduct = {
  productId: string;
  sequence: number;
  description: string;
  quantity: string | null;
  unit: string | null;
  /** The code stored for it, if any (not approved, or only a placeholder). */
  hsCode: string | null;
  /** Plain-language reason it is missing from the groups. */
  reason: string;
};

type ProductLike = {
  id: string;
  productSequence: number;
  status: string;
  productName: string | null;
  normalizedDescription: string | null;
  rawDescription: string;
  quantity: string | null;
  unitOfMeasure: string | null;
};

export function findUnclassifiedProducts(
  products: ProductLike[],
  groupedProductIds: Set<string>,
  hsCodeByProduct: Map<string, string | null | undefined>,
): UnclassifiedProduct[] {
  const out: UnclassifiedProduct[] = [];
  for (const p of products) {
    if (groupedProductIds.has(p.id)) continue;
    const stored = hsCodeByProduct.get(p.id) ?? null;
    const real = stored && !isPlaceholderHsCode(stored) ? stored : null;
    let reason: string;
    if (!stored) reason = "No HS code yet";
    else if (!real) reason = "No usable HS code could be suggested";
    else if (p.status === "approved_for_declaration" || p.status === "classified") {
      reason = "Approved, but not in the groups yet - run grouping again";
    } else reason = `Has code ${real} but it is not approved for declaration`;
    out.push({
      productId: p.id,
      sequence: p.productSequence,
      description: (p.productName ?? p.normalizedDescription ?? p.rawDescription ?? "").trim(),
      quantity: p.quantity,
      unit: p.unitOfMeasure,
      hsCode: real,
      reason,
    });
  }
  return out.sort((a, b) => a.sequence - b.sequence);
}