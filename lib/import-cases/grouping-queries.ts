import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  importProducts,
  productClassifications,
  productGroupingItems,
  productGroupings,
  tariffSnapshots,
} from "@/db/schema";

export type GroupingWithProducts = {
  grouping: typeof productGroupings.$inferSelect;
  products: Array<{
    product: typeof importProducts.$inferSelect;
    classification: typeof productClassifications.$inferSelect | null;
    tariffSnapshot: typeof tariffSnapshots.$inferSelect | null;
  }>;
  totalQuantity: number;
};

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
