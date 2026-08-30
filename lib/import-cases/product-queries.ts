import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  importProducts,
  invoiceLines,
  packingListLines,
  productInvoiceLines,
  productPackingListLines,
} from "@/db/schema";

export type CaseProductWithSources = {
  product: typeof importProducts.$inferSelect;
  invoiceSources: Array<{
    link: typeof productInvoiceLines.$inferSelect;
    line: typeof invoiceLines.$inferSelect;
  }>;
  packingSources: Array<{
    link: typeof productPackingListLines.$inferSelect;
    line: typeof packingListLines.$inferSelect;
  }>;
};

export async function getCaseProducts(
  caseId: string,
): Promise<CaseProductWithSources[]> {
  const products = await db
    .select()
    .from(importProducts)
    .where(eq(importProducts.importCaseId, caseId))
    .orderBy(importProducts.productSequence);

  const result: CaseProductWithSources[] = [];

  for (const product of products) {
    const invLinks = await db
      .select({
        link: productInvoiceLines,
        line: invoiceLines,
      })
      .from(productInvoiceLines)
      .innerJoin(
        invoiceLines,
        eq(productInvoiceLines.invoiceLineId, invoiceLines.id),
      )
      .where(eq(productInvoiceLines.productId, product.id));

    const packLinks = await db
      .select({
        link: productPackingListLines,
        line: packingListLines,
      })
      .from(productPackingListLines)
      .innerJoin(
        packingListLines,
        eq(productPackingListLines.packingListLineId, packingListLines.id),
      )
      .where(eq(productPackingListLines.productId, product.id));

    result.push({
      product,
      invoiceSources: invLinks,
      packingSources: packLinks,
    });
  }

  return result;
}
