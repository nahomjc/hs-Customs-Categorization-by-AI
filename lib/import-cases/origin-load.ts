/**
 * Loads the real origin data of a case (database): the origin written on each
 * product's linked invoice and packing lines, and the case-level fallback.
 * The rules live in origin.ts (pure).
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  importCases,
  importProducts,
  invoiceLines,
  packingListLines,
  productInvoiceLines,
  productPackingListLines,
} from "@/db/schema";
import { caseOriginFallback } from "./origin";

export type ProductLineOrigins = { invoice: string[]; packing: string[] };

export type CaseOriginData = {
  /** Origin, else country of export, else supplier country of the case. */
  caseOrigin: string | null;
  byProduct: Map<string, ProductLineOrigins>;
};

export async function loadCaseOriginData(caseId: string): Promise<CaseOriginData> {
  const [caseRow] = await db
    .select({
      countryOfOriginCode: importCases.countryOfOriginCode,
      countryOfExportCode: importCases.countryOfExportCode,
      supplierCountryCode: importCases.supplierCountryCode,
    })
    .from(importCases)
    .where(eq(importCases.id, caseId))
    .limit(1);

  const productRows = await db
    .select({ id: importProducts.id })
    .from(importProducts)
    .where(eq(importProducts.importCaseId, caseId));
  const ids = productRows.map((p) => p.id);

  const byProduct = new Map<string, ProductLineOrigins>();
  const entry = (productId: string): ProductLineOrigins => {
    let e = byProduct.get(productId);
    if (!e) {
      e = { invoice: [], packing: [] };
      byProduct.set(productId, e);
    }
    return e;
  };

  if (ids.length > 0) {
    const [inv, pack] = await Promise.all([
      db
        .select({
          productId: productInvoiceLines.productId,
          origin: invoiceLines.countryOfOriginCode,
        })
        .from(productInvoiceLines)
        .innerJoin(invoiceLines, eq(invoiceLines.id, productInvoiceLines.invoiceLineId))
        .where(inArray(productInvoiceLines.productId, ids)),
      db
        .select({
          productId: productPackingListLines.productId,
          origin: packingListLines.countryOfOriginCode,
        })
        .from(productPackingListLines)
        .innerJoin(
          packingListLines,
          eq(packingListLines.id, productPackingListLines.packingListLineId),
        )
        .where(inArray(productPackingListLines.productId, ids)),
    ]);
    for (const r of inv) if (r.origin) entry(r.productId).invoice.push(r.origin);
    for (const r of pack) if (r.origin) entry(r.productId).packing.push(r.origin);
  }

  return { caseOrigin: caseOriginFallback(caseRow), byProduct };
}