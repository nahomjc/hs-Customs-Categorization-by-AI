import { eq } from "drizzle-orm";
import { db } from "@/db";
import { checkPlausibility, type PlausibilityVerdict } from "@/lib/hs-plausibility";
import { loadSupplierHsByProduct } from "./product-context-load";
import {
  hsCodeCandidates,
  importProducts,
  productClassifications,
  tariffSnapshots,
} from "@/db/schema";

export type ProductClassificationBundle = {
  product: typeof importProducts.$inferSelect;
  candidates: Array<typeof hsCodeCandidates.$inferSelect>;
  classification: typeof productClassifications.$inferSelect | null;
  tariffSnapshot: typeof tariffSnapshots.$inferSelect | null;
  /**
   * Does the current code fit the product (chapter / section, supplier's invoice
   * code as a hint)? null when the product has no real code yet.
   */
  plausibility?: PlausibilityVerdict | null;
};

export async function getCaseClassifications(
  caseId: string,
): Promise<ProductClassificationBundle[]> {
  const products = await db
    .select()
    .from(importProducts)
    .where(eq(importProducts.importCaseId, caseId))
    .orderBy(importProducts.productSequence);

  const result: ProductClassificationBundle[] = [];
  const supplierHs = await loadSupplierHsByProduct(caseId);

  for (const product of products) {
    const [candidates, classifications, snapshots] = await Promise.all([
      db
        .select()
        .from(hsCodeCandidates)
        .where(eq(hsCodeCandidates.productId, product.id))
        .orderBy(hsCodeCandidates.rank),
      db
        .select()
        .from(productClassifications)
        .where(eq(productClassifications.productId, product.id)),
      db
        .select()
        .from(tariffSnapshots)
        .where(eq(tariffSnapshots.productId, product.id)),
    ]);

    const classification = classifications[0] ?? null;
    const verdict = classification
      ? checkPlausibility({
          hsCode: classification.hsCode,
          texts: [product.productName, product.rawDescription, product.normalizedDescription],
          supplierHsCode: supplierHs.get(product.id) ?? null,
        })
      : null;

    result.push({
      product,
      candidates,
      classification,
      tariffSnapshot: snapshots[0] ?? null,
      plausibility: verdict && verdict.status !== "unknown" ? verdict : null,
    });
  }

  return result;
}
