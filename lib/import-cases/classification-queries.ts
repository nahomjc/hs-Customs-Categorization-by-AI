import { eq } from "drizzle-orm";
import { db } from "@/db";
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

    result.push({
      product,
      candidates,
      classification: classifications[0] ?? null,
      tariffSnapshot: snapshots[0] ?? null,
    });
  }

  return result;
}
