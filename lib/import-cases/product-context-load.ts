/**
 * Loads the real context of one product (database): its own record, the linked
 * invoice and packing lines (including their `extra` columns), the case and
 * the other products of the case. The pure part lives in product-context.ts.
 */

import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { extractSupplierHsCode } from "@/lib/hs-plausibility";
import { db } from "@/db";
import {
  importCases,
  importProducts,
  invoiceLines,
  packingListLines,
  productInvoiceLines,
  productPackingListLines,
} from "@/db/schema";
import {
  CONTEXT_LIMITS,
  buildProductContext,
  withReviewerNote,
  type ProductContext,
} from "./product-context";

type ProductRow = typeof importProducts.$inferSelect;

export async function loadProductContext(
  product: ProductRow,
): Promise<ProductContext> {
  try {
    const [invoiceLinks, packingLinks, caseRows, others] = await Promise.all([
      db
        .select({ id: productInvoiceLines.invoiceLineId })
        .from(productInvoiceLines)
        .where(eq(productInvoiceLines.productId, product.id)),
      db
        .select({ id: productPackingListLines.packingListLineId })
        .from(productPackingListLines)
        .where(eq(productPackingListLines.productId, product.id)),
      db
        .select()
        .from(importCases)
        .where(eq(importCases.id, product.importCaseId))
        .limit(1),
      db
        .select({
          normalized: importProducts.normalizedDescription,
          raw: importProducts.rawDescription,
          name: importProducts.productName,
        })
        .from(importProducts)
        .where(
          and(
            eq(importProducts.importCaseId, product.importCaseId),
            ne(importProducts.id, product.id),
          ),
        )
        .orderBy(asc(importProducts.productSequence))
        .limit(CONTEXT_LIMITS.otherProducts * 2),
    ]);

    const invIds = invoiceLinks.map((l) => l.id).slice(0, CONTEXT_LIMITS.lines);
    const packIds = packingLinks.map((l) => l.id).slice(0, CONTEXT_LIMITS.lines);

    const [inv, pack] = await Promise.all([
      invIds.length
        ? db.select().from(invoiceLines).where(inArray(invoiceLines.id, invIds))
        : Promise.resolve([]),
      packIds.length
        ? db
            .select()
            .from(packingListLines)
            .where(inArray(packingListLines.id, packIds))
        : Promise.resolve([]),
    ]);

    return buildProductContext({
      product,
      invoiceLines: inv,
      packingLines: pack,
      caseInfo: caseRows[0] ?? null,
      otherProducts: others
        .map((o) => (o.normalized ?? o.raw ?? o.name ?? "").trim())
        .filter(Boolean),
    });
  } catch (error) {
    // context is a bonus: classification must still work without it
    console.warn(
      "[HS context] could not load product context:",
      error instanceof Error ? error.message : error,
    );
    return buildProductContext({ product });
  }
}

/**
 * The supplier's HS code (digits) per product of a case, read from the `extra`
 * columns of the linked invoice / packing lines. Only products that have one
 * are in the map. A hint, never the truth.
 */
export async function loadSupplierHsByProduct(
  caseId: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const [inv, pack] = await Promise.all([
      db
        .select({ productId: productInvoiceLines.productId, extra: invoiceLines.extra })
        .from(productInvoiceLines)
        .innerJoin(invoiceLines, eq(invoiceLines.id, productInvoiceLines.invoiceLineId))
        .innerJoin(importProducts, eq(importProducts.id, productInvoiceLines.productId))
        .where(eq(importProducts.importCaseId, caseId)),
      db
        .select({ productId: productPackingListLines.productId, extra: packingListLines.extra })
        .from(productPackingListLines)
        .innerJoin(
          packingListLines,
          eq(packingListLines.id, productPackingListLines.packingListLineId),
        )
        .innerJoin(importProducts, eq(importProducts.id, productPackingListLines.productId))
        .where(eq(importProducts.importCaseId, caseId)),
    ]);
    const extras = new Map<string, Array<Record<string, string> | null>>();
    for (const r of [...inv, ...pack]) {
      const list = extras.get(r.productId) ?? [];
      list.push(r.extra ?? null);
      extras.set(r.productId, list);
    }
    for (const [productId, list] of extras) {
      const code = extractSupplierHsCode(list);
      if (code) out.set(productId, code);
    }
  } catch (error) {
    console.warn(
      "[HS context] could not load supplier HS codes:",
      error instanceof Error ? error.message : error,
    );
  }
  return out;
}

/**
 * Saves (or clears, when empty) the reviewer's note on the product. Stored in
 * the product's `technical_specifications` JSON under `reviewerNote`, so no
 * migration is needed and the note survives re-classification.
 */
export async function saveProductNote(
  product: ProductRow,
  note: string,
  userId: string | null,
): Promise<ProductRow> {
  const specs = withReviewerNote(product.technicalSpecifications, note, {
    byUserId: userId ?? undefined,
    at: new Date().toISOString(),
  });
  const [updated] = await db
    .update(importProducts)
    .set({ technicalSpecifications: specs, updatedAt: new Date() })
    .where(eq(importProducts.id, product.id))
    .returning();
  return updated ?? { ...product, technicalSpecifications: specs };
}