import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  importProducts,
  productClassifications,
  productGroupingItems,
  productGroupings,
  tariffSnapshots,
} from "@/db/schema";

import { findUnclassifiedProducts, type UnclassifiedProduct } from "./unclassified";

export type GroupingWithProducts = {
  grouping: typeof productGroupings.$inferSelect;
  products: Array<{
    product: typeof importProducts.$inferSelect;
    classification: typeof productClassifications.$inferSelect | null;
    tariffSnapshot: typeof tariffSnapshots.$inferSelect | null;
  }>;
  totalQuantity: number;
};

/** Every product of the case that is not in any declaration group (with the reason). */
export async function getUnclassifiedProducts(
  caseId: string,
): Promise<UnclassifiedProduct[]> {
  const products = await db
    .select()
    .from(importProducts)
    .where(eq(importProducts.importCaseId, caseId))
    .orderBy(importProducts.productSequence);
  if (products.length === 0) return [];

  const ids = products.map((p) => p.id);
  const [grouped, classifications] = await Promise.all([
    db
      .select({ productId: productGroupingItems.productId })
      .from(productGroupingItems)
      .innerJoin(productGroupings, eq(productGroupings.id, productGroupingItems.groupingId))
      .where(eq(productGroupings.importCaseId, caseId)),
    db
      .select({
        productId: productClassifications.productId,
        hsCode: productClassifications.hsCode,
      })
      .from(productClassifications)
      .where(inArray(productClassifications.productId, ids)),
  ]);

  return findUnclassifiedProducts(
    products,
    new Set(grouped.map((g) => g.productId)),
    new Map(classifications.map((c) => [c.productId, c.hsCode])),
  );
}

export async function getCaseGroupings(
  caseId: string,
): Promise<GroupingWithProducts[]> {
  const groupings = await db
    .select()
    .from(productGroupings)
    .where(eq(productGroupings.importCaseId, caseId))
    .orderBy(productGroupings.groupCode);

  const result: GroupingWithProducts[] = [];

  for (const grouping of groupings) {
    const items = await db
      .select({ productId: productGroupingItems.productId })
      .from(productGroupingItems)
      .where(eq(productGroupingItems.groupingId, grouping.id));

    const products = await Promise.all(
      items.map(async ({ productId }) => {
        const [product] = await db
          .select()
          .from(importProducts)
          .where(eq(importProducts.id, productId))
          .limit(1);
        const [classification] = await db
          .select()
          .from(productClassifications)
          .where(eq(productClassifications.productId, productId))
          .limit(1);
        const [tariffSnapshot] = await db
          .select()
          .from(tariffSnapshots)
          .where(eq(tariffSnapshots.productId, productId))
          .limit(1);
        return {
          product: product!,
          classification: classification ?? null,
          tariffSnapshot: tariffSnapshot ?? null,
        };
      }),
    );

    const totalQuantity = products.reduce(
      (sum, p) => sum + (Number.parseFloat(p.product.quantity ?? "0") || 0),
      0,
    );

    result.push({ grouping, products, totalQuantity });
  }

  return result;
}
