import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  importCases,
  importProducts,
  productClassifications,
  productGroupingItems,
  productGroupings,
  tariffSnapshots,
} from "@/db/schema";
import { writeAuditLog } from "./queries";

export type GroupResult = {
  groupCount: number;
  productCount: number;
};

type GroupKey = {
  hsCode: string;
  countryOfOriginCode: string;
  procedureCode: string;
  taxProfileHash: string;
  unitOfMeasure: string;
};

function buildTaxProfileHash(
  snapshots: Array<{ customsDutyRate: string | null }>,
): string {
  const rates = snapshots
    .map((s) => s.customsDutyRate ?? "0")
    .sort()
    .join("|");
  return createHash("sha256").update(rates).digest("hex").slice(0, 32);
}

function groupKeyString(key: GroupKey): string {
  return [
    key.hsCode,
    key.countryOfOriginCode,
    key.procedureCode,
    key.taxProfileHash,
    key.unitOfMeasure,
  ].join("::");
}

export async function groupImportCaseProducts(
  caseId: string,
  tenantId: string,
  userId?: string | null,
  options?: { replaceExisting?: boolean },
): Promise<GroupResult> {
  const replaceExisting = options?.replaceExisting ?? true;

  const [importCase] = await db
    .select()
    .from(importCases)
    .where(eq(importCases.id, caseId))
    .limit(1);

  if (!importCase) throw new Error("Import case not found");

  const products = await db
    .select()
    .from(importProducts)
    .where(eq(importProducts.importCaseId, caseId))
    .orderBy(importProducts.productSequence);

  const approvedProducts = products.filter(
    (p) =>
      p.status === "approved_for_declaration" || p.status === "classified",
  );

  if (approvedProducts.length === 0) {
    throw new Error(
      "No products approved for declaration — approve HS classifications first",
    );
  }

  const classifications = await Promise.all(
    approvedProducts.map(async (p) => {
      const [cls] = await db
        .select()
        .from(productClassifications)
        .where(
          and(
            eq(productClassifications.productId, p.id),
            eq(productClassifications.isFinal, true),
          ),
        )
        .limit(1);
      const [snapshot] = await db
        .select()
        .from(tariffSnapshots)
        .where(eq(tariffSnapshots.productId, p.id))
        .limit(1);
      return { product: p, classification: cls, snapshot };
    }),
  );

  const missing = classifications.filter((c) => !c.classification);
  if (missing.length > 0) {
    throw new Error(
      `${missing.length} product(s) lack final HS classification`,
    );
  }

  if (replaceExisting) {
    const existing = await db
      .select({ id: productGroupings.id })
      .from(productGroupings)
      .where(eq(productGroupings.importCaseId, caseId));
    if (existing.length > 0) {
      await db
        .delete(productGroupings)
        .where(eq(productGroupings.importCaseId, caseId));
    }
  }

  const procedureCode = importCase.importProcedureCode ?? "IM4";
  const buckets = new Map<
    string,
    {
      key: GroupKey;
      items: typeof classifications;
    }
  >();

  for (const item of classifications) {
    const cls = item.classification!;
    const key: GroupKey = {
      hsCode: cls.hsCode,
      countryOfOriginCode:
        item.product.countryOfOriginCode ??
        importCase.countryOfOriginCode ??
        "UNK",
      procedureCode,
      taxProfileHash: buildTaxProfileHash(
        item.snapshot ? [item.snapshot] : [],
      ),
      unitOfMeasure: item.product.unitOfMeasure ?? "PCS",
    };
    const keyStr = groupKeyString(key);
    const bucket = buckets.get(keyStr);
    if (bucket) {
      bucket.items.push(item);
    } else {
      buckets.set(keyStr, { key, items: [item] });
    }
  }

  let groupIndex = 0;
  for (const [, bucket] of buckets) {
    groupIndex++;
    const groupCode = `GRP-${String(groupIndex).padStart(3, "0")}`;
    const totalQty = bucket.items.reduce(
      (sum, i) => sum + (Number.parseFloat(i.product.quantity ?? "0") || 0),
      0,
    );

    const [grouping] = await db
      .insert(productGroupings)
      .values({
        importCaseId: caseId,
        groupCode,
        status: "ready_for_review",
        hsCode: bucket.key.hsCode,
        countryOfOriginCode: bucket.key.countryOfOriginCode,
        procedureCode: bucket.key.procedureCode,
        taxProfileHash: bucket.key.taxProfileHash,
        unitOfMeasure: bucket.key.unitOfMeasure,
        groupingReason: `${bucket.items.length} product(s), total qty ${totalQty}`,
      })
      .returning();

    await db.insert(productGroupingItems).values(
      bucket.items.map((i) => ({
        groupingId: grouping.id,
        productId: i.product.id,
      })),
    );
  }

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId: userId ?? null,
    entityType: "import_case",
    entityId: caseId,
    action: "grouping_created",
    newData: { groupCount: buckets.size, productCount: approvedProducts.length },
  });

  return {
    groupCount: buckets.size,
    productCount: approvedProducts.length,
  };
}
