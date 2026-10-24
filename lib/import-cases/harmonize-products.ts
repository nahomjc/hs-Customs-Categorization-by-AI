import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  importCases,
  importProducts,
  invoiceLines,
  packingListLines,
  productInvoiceLines,
  productPackingListLines,
  vddProductMatches,
} from "@/db/schema";
import {
  buildHarmonizePlan,
  mapWithConcurrency,
  type HarmonizePlan,
  type HarmonizeSlot,
} from "./harmonize-plan";
import { normalizeProductDescription } from "./normalize-product";
import { writeAuditLog } from "./queries";
import {
  persistVddMatchesForProduct,
  persistVddMatchesForProducts,
} from "@/lib/vdd/persist-product-matches";

export type HarmonizeResult = {
  productCount: number;
  matchCount: number;
  unmatchedInvoiceCount: number;
  unmatchedPackingCount: number;
  vddMatchTotal: number;
};

type InvoiceRow = typeof invoiceLines.$inferSelect;
type PackingRow = typeof packingListLines.$inferSelect;
type Plan = HarmonizePlan<InvoiceRow, PackingRow>;
type Slot = HarmonizeSlot<InvoiceRow, PackingRow>;

/** Thrown when the source lines changed between the start and a later batch. */
export class HarmonizePlanChangedError extends Error {
  constructor() {
    super(
      "The invoice or packing lines changed while harmonizing. Start harmonization again.",
    );
    this.name = "HarmonizePlanChangedError";
  }
}

/** Products normalized in parallel inside one batch request. */
const NORMALIZE_CONCURRENCY = 3;

async function loadPlan(caseId: string): Promise<Plan> {
  const [invRows, packRows] = await Promise.all([
    db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.importCaseId, caseId))
      .orderBy(
        asc(invoiceLines.lineNumber),
        asc(invoiceLines.createdAt),
        asc(invoiceLines.id),
      ),
    db
      .select()
      .from(packingListLines)
      .where(eq(packingListLines.importCaseId, caseId))
      .orderBy(
        asc(packingListLines.lineNumber),
        asc(packingListLines.createdAt),
        asc(packingListLines.id),
      ),
  ]);

  if (invRows.length === 0) {
    throw new Error("No invoice lines to harmonize");
  }
  return buildHarmonizePlan(invRows, packRows);
}

async function createProductForSlot(
  caseId: string,
  slot: Slot,
): Promise<{ status: string; reused: boolean }> {
  // Idempotent: a sequence that already has a product is never created twice.
  const [existing] = await db
    .select({ id: importProducts.id, status: importProducts.status })
    .from(importProducts)
    .where(
      and(
        eq(importProducts.importCaseId, caseId),
        eq(importProducts.productSequence, slot.sequence),
      ),
    )
    .limit(1);
  if (existing) return { status: existing.status, reused: true };

  const inv = slot.inv;
  const pack = slot.pack;

  const normalization = await normalizeProductDescription({
    invoiceDescription:
      inv?.supplierDescription ?? pack?.supplierDescription ?? "",
    packingDescription: pack?.supplierDescription ?? null,
    supplierSku: inv?.supplierSku ?? pack?.supplierSku ?? null,
    brand: inv?.brand ?? pack?.brand ?? null,
    modelNumber: inv?.modelNumber ?? pack?.modelNumber ?? null,
  });

  const rawParts = [inv?.supplierDescription, pack?.supplierDescription].filter(
    Boolean,
  );
  const matchConfidence =
    slot.matchConfidence !== undefined ? String(slot.matchConfidence) : null;

  // Product row and its source links are written together or not at all, so a
  // retried slot can never leave a product without its links.
  await db.transaction(async (tx) => {
    const [product] = await tx
      .insert(importProducts)
      .values({
        importCaseId: caseId,
        productSequence: slot.sequence,
        status: slot.status,
        rawDescription: rawParts.join(" | ") || "Unknown product",
        normalizedDescription: normalization.normalizedDescription,
        productName: normalization.productName ?? null,
        brand: inv?.brand ?? pack?.brand ?? null,
        modelNumber: inv?.modelNumber ?? pack?.modelNumber ?? null,
        material: normalization.material ?? null,
        intendedUse: normalization.intendedUse ?? null,
        productType: normalization.productType ?? null,
        technicalSpecifications: normalization.technicalSpecifications ?? null,
        quantity: inv?.quantity ?? pack?.quantity ?? null,
        unitOfMeasure: inv?.unitOfMeasure ?? pack?.unitOfMeasure ?? null,
        unitPrice: inv?.unitPrice ?? null,
        lineTotalAmount: inv?.lineTotalAmount ?? null,
        currencyCode: inv?.currencyCode ?? null,
        countryOfOriginCode:
          inv?.countryOfOriginCode ?? pack?.countryOfOriginCode ?? null,
        netWeightKg: pack?.netWeightKg ?? null,
        grossWeightKg: pack?.grossWeightKg ?? null,
        packageType: pack?.packageType ?? null,
        numberOfPackages: pack?.numberOfPackages ?? null,
        missingInformation: [
          ...(normalization.missingInformation ?? []),
          ...slot.missingInfo,
        ],
        normalizationConfidence: String(
          normalization.normalizationConfidence ?? 0.5,
        ),
        humanVerified: false,
      })
      .onConflictDoNothing()
      .returning({ id: importProducts.id });

    if (!product) return;

    if (inv) {
      await tx.insert(productInvoiceLines).values({
        productId: product.id,
        invoiceLineId: inv.id,
        matchConfidence,
        isConfirmed: false,
      });
    }
    if (pack) {
      await tx.insert(productPackingListLines).values({
        productId: product.id,
        packingListLineId: pack.id,
        matchConfidence,
        isConfirmed: false,
      });
    }
  });

  return { status: slot.status, reused: false };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/* ------------------------------------------------------------------ */
/* Batched run (used by the progress dialog)                           */
/* ------------------------------------------------------------------ */

export type HarmonizeStartInfo = {
  planKey: string;
  /** Number of products this run will create. */
  total: number;
  matchCount: number;
  unmatchedInvoiceCount: number;
  unmatchedPackingCount: number;
};

/** Step 1: build the plan and clear the previous products (same as before). */
export async function startHarmonizeRun(
  caseId: string,
  options?: { replaceExisting?: boolean },
): Promise<HarmonizeStartInfo> {
  const replaceExisting = options?.replaceExisting ?? true;
  const plan = await loadPlan(caseId);

  if (replaceExisting) {
    await db.delete(importProducts).where(eq(importProducts.importCaseId, caseId));
  }

  return {
    planKey: plan.planKey,
    total: plan.slots.length,
    matchCount: plan.matchCount,
    unmatchedInvoiceCount: plan.unmatchedInvoiceCount,
    unmatchedPackingCount: plan.unmatchedPackingCount,
  };
}

export type HarmonizeProductResult =
  | { sequence: number; ok: true; status: string; reused: boolean }
  | { sequence: number; ok: false; error: string };

/** Step 2 (repeat): create the products for these sequences. Safe to retry. */
export async function harmonizeProductSequences(
  caseId: string,
  planKey: string,
  sequences: number[],
): Promise<HarmonizeProductResult[]> {
  const plan = await loadPlan(caseId);
  if (plan.planKey !== planKey) throw new HarmonizePlanChangedError();

  const unique = [...new Set(sequences)].sort((a, b) => a - b);
  return mapWithConcurrency(
    unique,
    NORMALIZE_CONCURRENCY,
    async (sequence): Promise<HarmonizeProductResult> => {
      const slot = plan.slots[sequence - 1];
      if (!slot || slot.sequence !== sequence) {
        return { sequence, ok: false, error: "Unknown product sequence" };
      }
      try {
        const created = await createProductForSlot(caseId, slot);
        return { sequence, ok: true, ...created };
      } catch (error) {
        return { sequence, ok: false, error: errorMessage(error) };
      }
    },
  );
}

export type HarmonizeVddResult =
  | { sequence: number; ok: true; matchCount: number }
  | { sequence: number; ok: false; error: string };

/** Step 3 (repeat): search and store VDD matches for these products. Safe to retry. */
export async function harmonizeVddSequences(
  caseId: string,
  tenantId: string,
  sequences: number[],
): Promise<HarmonizeVddResult[]> {
  const unique = [...new Set(sequences)].sort((a, b) => a - b);
  if (unique.length === 0) return [];

  const products = await db
    .select()
    .from(importProducts)
    .where(
      and(
        eq(importProducts.importCaseId, caseId),
        inArray(importProducts.productSequence, unique),
      ),
    );
  const bySequence = new Map(products.map((p) => [p.productSequence, p]));

  const results: HarmonizeVddResult[] = [];
  for (const sequence of unique) {
    const product = bySequence.get(sequence);
    if (!product) {
      results.push({ sequence, ok: false, error: "Product not found" });
      continue;
    }
    try {
      const { matchCount } = await persistVddMatchesForProduct(tenantId, product);
      results.push({ sequence, ok: true, matchCount });
    } catch (error) {
      results.push({ sequence, ok: false, error: errorMessage(error) });
    }
  }
  return results;
}

async function countVddMatches(caseId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(vddProductMatches)
    .innerJoin(importProducts, eq(importProducts.id, vddProductMatches.productId))
    .where(eq(importProducts.importCaseId, caseId));
  return Number(row?.n ?? 0);
}

/** Step 4: mark the case ready and write the audit entry (same as before). */
export async function finalizeHarmonizeRun(
  caseId: string,
  tenantId: string,
  userId: string | null | undefined,
  planKey: string,
  knownPlan?: Plan,
): Promise<HarmonizeResult> {
  const plan = knownPlan ?? (await loadPlan(caseId));
  if (plan.planKey !== planKey) throw new HarmonizePlanChangedError();

  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(importProducts)
    .where(eq(importProducts.importCaseId, caseId));
  const saved = Number(row?.n ?? 0);
  if (saved !== plan.slots.length) {
    throw new Error(
      `Only ${saved} of ${plan.slots.length} products were saved. Retry the failed products first.`,
    );
  }

  await db
    .update(importCases)
    .set({
      status: "ready_for_classification",
      updatedAt: new Date(),
    })
    .where(eq(importCases.id, caseId));

  const vddMatchTotal = await countVddMatches(caseId);

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId: userId ?? null,
    entityType: "import_case",
    entityId: caseId,
    action: "product_harmonized",
    newData: {
      productCount: plan.slots.length,
      matchCount: plan.matchCount,
      vddMatchTotal,
    },
  });

  return {
    productCount: plan.slots.length,
    matchCount: plan.matchCount,
    unmatchedInvoiceCount: plan.unmatchedInvoiceCount,
    unmatchedPackingCount: plan.unmatchedPackingCount,
    vddMatchTotal,
  };
}

/* ------------------------------------------------------------------ */
/* Single blocking run (kept for callers that send no batch action)    */
/* ------------------------------------------------------------------ */

export async function harmonizeImportCase(
  caseId: string,
  tenantId: string,
  userId?: string | null,
  options?: { replaceExisting?: boolean },
): Promise<HarmonizeResult> {
  const replaceExisting = options?.replaceExisting ?? true;
  const plan = await loadPlan(caseId);

  if (replaceExisting) {
    await db.delete(importProducts).where(eq(importProducts.importCaseId, caseId));
  }

  for (const slot of plan.slots) {
    await createProductForSlot(caseId, slot);
  }

  // Search VDD for each created product and persist matches (decision support).
  const created = await db
    .select()
    .from(importProducts)
    .where(eq(importProducts.importCaseId, caseId))
    .orderBy(asc(importProducts.productSequence));
  if (created.length > 0) {
    await persistVddMatchesForProducts(tenantId, created);
  }

  return finalizeHarmonizeRun(caseId, tenantId, userId, plan.planKey, plan);
}