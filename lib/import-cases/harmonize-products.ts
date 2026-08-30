import { eq } from "drizzle-orm";
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
  matchInvoiceAndPackingLines,
  type InvoiceLineInput,
  type PackingLineInput,
} from "./match-lines";
import { normalizeProductDescription } from "./normalize-product";
import { writeAuditLog } from "./queries";

export type HarmonizeResult = {
  productCount: number;
  matchCount: number;
  unmatchedInvoiceCount: number;
  unmatchedPackingCount: number;
};

export async function harmonizeImportCase(
  caseId: string,
  tenantId: string,
  userId?: string | null,
  options?: { replaceExisting?: boolean },
): Promise<HarmonizeResult> {
  const replaceExisting = options?.replaceExisting ?? true;

  const [invRows, packRows, existingProducts] = await Promise.all([
    db.select().from(invoiceLines).where(eq(invoiceLines.importCaseId, caseId)),
    db
      .select()
      .from(packingListLines)
      .where(eq(packingListLines.importCaseId, caseId)),
    db
      .select({ id: importProducts.id })
      .from(importProducts)
      .where(eq(importProducts.importCaseId, caseId)),
  ]);

  if (invRows.length === 0) {
    throw new Error("No invoice lines to harmonize");
  }

  const invoiceInputs: InvoiceLineInput[] = invRows.map((r) => ({
    id: r.id,
    lineNumber: r.lineNumber,
    supplierDescription: r.supplierDescription,
    supplierSku: r.supplierSku,
    brand: r.brand,
    modelNumber: r.modelNumber,
    quantity: r.quantity,
    unitOfMeasure: r.unitOfMeasure,
  }));

  const packingInputs: PackingLineInput[] = packRows.map((r) => ({
    id: r.id,
    lineNumber: r.lineNumber,
    supplierDescription: r.supplierDescription,
    supplierSku: r.supplierSku,
    brand: r.brand,
    modelNumber: r.modelNumber,
    quantity: r.quantity,
    unitOfMeasure: r.unitOfMeasure,
  }));

  const matchResult = matchInvoiceAndPackingLines(
    invoiceInputs,
    packingInputs,
  );

  const invById = new Map(invRows.map((r) => [r.id, r]));
  const packById = new Map(packRows.map((r) => [r.id, r]));

  if (replaceExisting && existingProducts.length > 0) {
    await db
      .delete(importProducts)
      .where(eq(importProducts.importCaseId, caseId));
  }

  let sequence = 0;
  const createdProductIds: string[] = [];

  async function createProduct(params: {
    inv?: (typeof invRows)[0];
    pack?: (typeof packRows)[0];
    matchConfidence?: number;
    status: string;
    missingInfo?: string[];
  }) {
    sequence += 1;
    const inv = params.inv;
    const pack = params.pack;

    const normalization = await normalizeProductDescription({
      invoiceDescription:
        inv?.supplierDescription ?? pack?.supplierDescription ?? "",
      packingDescription: pack?.supplierDescription ?? null,
      supplierSku: inv?.supplierSku ?? pack?.supplierSku ?? null,
      brand: inv?.brand ?? pack?.brand ?? null,
      modelNumber: inv?.modelNumber ?? pack?.modelNumber ?? null,
    });

    const rawParts = [
      inv?.supplierDescription,
      pack?.supplierDescription,
    ].filter(Boolean);

    const [product] = await db
      .insert(importProducts)
      .values({
        importCaseId: caseId,
        productSequence: sequence,
        status: params.status,
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
          ...(params.missingInfo ?? []),
        ],
        normalizationConfidence: String(
          normalization.normalizationConfidence ?? 0.5,
        ),
        humanVerified: false,
      })
      .returning({ id: importProducts.id });

    if (!product) return;

    createdProductIds.push(product.id);

    if (inv) {
      await db.insert(productInvoiceLines).values({
        productId: product.id,
        invoiceLineId: inv.id,
        matchConfidence:
          params.matchConfidence !== undefined
            ? String(params.matchConfidence)
            : null,
        isConfirmed: false,
      });
    }

    if (pack) {
      await db.insert(productPackingListLines).values({
        productId: product.id,
        packingListLineId: pack.id,
        matchConfidence:
          params.matchConfidence !== undefined
            ? String(params.matchConfidence)
            : null,
        isConfirmed: false,
      });
    }
  }

  // Matched pairs
  for (const match of matchResult.matches) {
    const inv = invById.get(match.invoiceLineId);
    const pack = packById.get(match.packingListLineId);
    if (!inv) continue;

    const qtyMismatch =
      pack && Number(inv.quantity) !== Number(pack.quantity);

    await createProduct({
      inv,
      pack,
      matchConfidence: match.confidence,
      status: qtyMismatch ? "needs_information" : "ready_for_hs_suggestion",
      missingInfo: qtyMismatch ? ["quantity_mismatch_between_sources"] : [],
    });
  }

  // Unmatched invoice lines
  for (const id of matchResult.unmatchedInvoiceLineIds) {
    const inv = invById.get(id);
    if (!inv) continue;
    await createProduct({
      inv,
      status: "needs_information",
      missingInfo: ["no_packing_list_match"],
    });
  }

  // Unmatched packing lines
  for (const id of matchResult.unmatchedPackingListLineIds) {
    const pack = packById.get(id);
    if (!pack) continue;
    await createProduct({
      pack,
      status: "needs_information",
      missingInfo: ["no_invoice_match"],
    });
  }

  await db
    .update(importCases)
    .set({
      status: "ready_for_classification",
      updatedAt: new Date(),
    })
    .where(eq(importCases.id, caseId));

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId: userId ?? null,
    entityType: "import_case",
    entityId: caseId,
    action: "product_harmonized",
    newData: {
      productCount: sequence,
      matchCount: matchResult.matches.length,
    },
  });

  return {
    productCount: sequence,
    matchCount: matchResult.matches.length,
    unmatchedInvoiceCount: matchResult.unmatchedInvoiceLineIds.length,
    unmatchedPackingCount: matchResult.unmatchedPackingListLineIds.length,
  };
}
