import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  importProducts,
  invoiceLines,
  packingListLines,
  productInvoiceLines,
  productPackingListLines,
  vddProductMatches,
  vddReferenceRecords,
} from "@/db/schema";

export type VddMatchSummary = {
  id: string;
  similarityScore: string;
  matchReasons: string[];
  differences: string[];
  hsCodeMatches: boolean | null;
  isUsedAsEvidence: boolean;
  priceComparison: unknown;
  hsCode: string;
  commonName: string | null;
  commercialDescription: string | null;
  brandOrMake: string | null;
  model: string | null;
  originCode: string | null;
  unitOfQuantity: string | null;
  declaredUnitPrice: string | null;
  currencyCode: string;
};

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
  vddMatches: VddMatchSummary[];
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

    const vddRows = await db
      .select({
        match: vddProductMatches,
        record: vddReferenceRecords,
      })
      .from(vddProductMatches)
      .innerJoin(
        vddReferenceRecords,
        eq(vddProductMatches.vddReferenceRecordId, vddReferenceRecords.id),
      )
      .where(eq(vddProductMatches.productId, product.id))
      .orderBy(desc(vddProductMatches.similarityScore))
      .limit(5);

    const vddMatches: VddMatchSummary[] = vddRows.map(({ match, record }) => ({
      id: match.id,
      similarityScore: match.similarityScore,
      matchReasons: Array.isArray(match.matchReasons)
        ? (match.matchReasons as string[])
        : [],
      differences: Array.isArray(match.differences)
        ? (match.differences as string[])
        : [],
      hsCodeMatches: match.hsCodeMatches,
      isUsedAsEvidence: match.isUsedAsEvidence,
      priceComparison: match.priceComparison,
      hsCode: record.hsCode,
      commonName: record.commonName,
      commercialDescription: record.commercialDescription,
      brandOrMake: record.brandOrMake,
      model: record.model,
      originCode: record.originCode,
      unitOfQuantity: record.unitOfQuantity,
      declaredUnitPrice: record.declaredUnitPrice,
      currencyCode: record.currencyCode,
    }));

    result.push({
      product,
      invoiceSources: invLinks,
      packingSources: packLinks,
      vddMatches,
    });
  }

  return result;
}
