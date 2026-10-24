import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  importCases,
  importProducts,
  productClassifications,
  productGroupingItems,
  productGroupings,
  tariffSnapshots,
} from "@/db/schema";
import { mapWithConcurrency } from "./harmonize-plan";
import {
  buildGroupingPlan,
  type GroupingPlan,
  type PlannedGroup,
} from "./grouping-plan";
import { writeAuditLog } from "./queries";

export type GroupResult = {
  groupCount: number;
  productCount: number;
};

/** Groups written in parallel inside one batch request. */
const GROUP_WRITE_CONCURRENCY = 3;

/** Thrown when the approved products changed between the start and a later batch. */
export class GroupingPlanChangedError extends Error {
  constructor() {
    super(
      "The approved products or their HS codes changed while grouping. Start grouping again.",
    );
    this.name = "GroupingPlanChangedError";
  }
}

/**
 * Read approved products with their final classification and tariff snapshot
 * and build the grouping plan. Throws the same errors as before.
 */
async function loadGroupingPlan(caseId: string): Promise<GroupingPlan> {
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
      "No products approved for declaration \u2014 approve HS classifications first",
    );
  }

  const ids = approvedProducts.map((p) => p.id);
  // two bulk reads instead of two queries per product; first row wins
  const [classificationRows, snapshotRows] = await Promise.all([
    db
      .select()
      .from(productClassifications)
      .where(
        and(
          inArray(productClassifications.productId, ids),
          eq(productClassifications.isFinal, true),
        ),
      )
      .orderBy(asc(productClassifications.createdAt), asc(productClassifications.id)),
    db
      .select()
      .from(tariffSnapshots)
      .where(inArray(tariffSnapshots.productId, ids))
      .orderBy(asc(tariffSnapshots.retrievedAt), asc(tariffSnapshots.id)),
  ]);
  const classificationByProduct = new Map<string, (typeof classificationRows)[number]>();
  for (const row of classificationRows) {
    if (!classificationByProduct.has(row.productId)) {
      classificationByProduct.set(row.productId, row);
    }
  }
  const snapshotByProduct = new Map<string, (typeof snapshotRows)[number]>();
  for (const row of snapshotRows) {
    if (!snapshotByProduct.has(row.productId)) {
      snapshotByProduct.set(row.productId, row);
    }
  }

  const missing = approvedProducts.filter(
    (p) => !classificationByProduct.has(p.id),
  );
  if (missing.length > 0) {
    throw new Error(
      `${missing.length} product(s) lack final HS classification`,
    );
  }

  return buildGroupingPlan(
    approvedProducts.map((p) => {
      const snapshot = snapshotByProduct.get(p.id);
      return {
        productId: p.id,
        hsCode: classificationByProduct.get(p.id)!.hsCode,
        countryOfOriginCode: p.countryOfOriginCode,
        unitOfMeasure: p.unitOfMeasure,
        quantity: p.quantity,
        snapshot: snapshot ? { customsDutyRate: snapshot.customsDutyRate } : null,
      };
    }),
    {
      caseCountryOfOriginCode: importCase.countryOfOriginCode,
      procedureCode: importCase.importProcedureCode ?? "IM4",
    },
  );
}

async function deleteExistingGroupings(caseId: string) {
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

/** Save one group and its products together or not at all. */
async function writeGroup(caseId: string, group: PlannedGroup) {
  await db.transaction(async (tx) => {
    const [grouping] = await tx
      .insert(productGroupings)
      .values({
        importCaseId: caseId,
        groupCode: group.groupCode,
        status: "ready_for_review",
        hsCode: group.key.hsCode,
        countryOfOriginCode: group.key.countryOfOriginCode,
        procedureCode: group.key.procedureCode,
        taxProfileHash: group.key.taxProfileHash,
        unitOfMeasure: group.key.unitOfMeasure,
        groupingReason: group.groupingReason,
      })
      .onConflictDoNothing()
      .returning();

    if (!grouping) return;

    await tx.insert(productGroupingItems).values(
      group.productIds.map((productId) => ({
        groupingId: grouping.id,
        productId,
      })),
    );
  });
}

async function auditGrouping(
  caseId: string,
  tenantId: string,
  userId: string | null | undefined,
  plan: GroupingPlan,
) {
  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId: userId ?? null,
    entityType: "import_case",
    entityId: caseId,
    action: "grouping_created",
    newData: { groupCount: plan.groups.length, productCount: plan.productCount },
  });
}

/* ------------------------------------------------------------------ */
/* Batched run (used by the grouping progress dialog)                  */
/* ------------------------------------------------------------------ */

export type GroupingStartInfo = {
  planKey: string;
  /** Number of declaration groups this run writes. */
  total: number;
  /** Group numbers 1..total. */
  sequences: number[];
  /** Approved products being grouped. */
  productCount: number;
};

/** Step 1: build the plan and clear the previous groups (same as before). */
export async function startGroupingRun(
  caseId: string,
  options?: { replaceExisting?: boolean },
): Promise<GroupingStartInfo> {
  const replaceExisting = options?.replaceExisting ?? true;
  const plan = await loadGroupingPlan(caseId);
  if (replaceExisting) await deleteExistingGroupings(caseId);
  return {
    planKey: plan.planKey,
    total: plan.groups.length,
    sequences: plan.groups.map((g) => g.sequence),
    productCount: plan.productCount,
  };
}

export type GroupingBatchResult =
  | {
      sequence: number;
      ok: true;
      productCount: number;
      totalQuantity: number;
      reused: boolean;
    }
  | { sequence: number; ok: false; error: string };

/** Step 2 (repeat): save these groups. A group code that already exists is skipped. */
export async function writeGroupingSequences(
  caseId: string,
  planKey: string,
  sequences: number[],
): Promise<GroupingBatchResult[]> {
  const plan = await loadGroupingPlan(caseId);
  if (plan.planKey !== planKey) throw new GroupingPlanChangedError();

  const unique = [...new Set(sequences)].sort((a, b) => a - b);
  return mapWithConcurrency(
    unique,
    GROUP_WRITE_CONCURRENCY,
    async (sequence): Promise<GroupingBatchResult> => {
      const group = plan.groups[sequence - 1];
      if (!group || group.sequence !== sequence) {
        return { sequence, ok: false, error: "Unknown group number" };
      }
      try {
        const [existing] = await db
          .select({ id: productGroupings.id })
          .from(productGroupings)
          .where(
            and(
              eq(productGroupings.importCaseId, caseId),
              eq(productGroupings.groupCode, group.groupCode),
            ),
          )
          .limit(1);
        let reused = true;
        if (!existing) {
          await writeGroup(caseId, group);
          reused = false;
        }
        return {
          sequence,
          ok: true,
          productCount: group.productIds.length,
          totalQuantity: group.totalQuantity,
          reused,
        };
      } catch (error) {
        return {
          sequence,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );
}

/** Step 3: check every group was saved, then write the audit entry (same as before). */
export async function finalizeGroupingRun(
  caseId: string,
  tenantId: string,
  userId: string | null | undefined,
  planKey: string,
): Promise<GroupResult> {
  const plan = await loadGroupingPlan(caseId);
  if (plan.planKey !== planKey) throw new GroupingPlanChangedError();

  const saved = await db
    .select({ id: productGroupings.id })
    .from(productGroupings)
    .where(eq(productGroupings.importCaseId, caseId));
  if (saved.length !== plan.groups.length) {
    throw new Error(
      `Only ${saved.length} of ${plan.groups.length} groups were saved. Retry the failed groups first.`,
    );
  }

  await auditGrouping(caseId, tenantId, userId, plan);
  return { groupCount: plan.groups.length, productCount: plan.productCount };
}

/* ------------------------------------------------------------------ */
/* Single blocking run (kept for callers that send no batch action)    */
/* ------------------------------------------------------------------ */

export async function groupImportCaseProducts(
  caseId: string,
  tenantId: string,
  userId?: string | null,
  options?: { replaceExisting?: boolean },
): Promise<GroupResult> {
  const replaceExisting = options?.replaceExisting ?? true;
  const plan = await loadGroupingPlan(caseId);

  if (replaceExisting) await deleteExistingGroupings(caseId);

  for (const group of plan.groups) {
    await writeGroup(caseId, group);
  }

  await auditGrouping(caseId, tenantId, userId, plan);

  return { groupCount: plan.groups.length, productCount: plan.productCount };
}