/**
 * Pure planning for declaration grouping (no DB). Approved products with a
 * final HS classification are bucketed by HS code, origin, procedure, tax
 * profile and unit. Group N becomes group code GRP-00N, in the order the
 * buckets first appear, so every request can rebuild the same plan.
 */
import { createHash } from "node:crypto";
import { stableHash } from "./harmonize-plan";

export type GroupKey = {
  hsCode: string;
  countryOfOriginCode: string;
  procedureCode: string;
  taxProfileHash: string;
  unitOfMeasure: string;
};

export type GroupingInput = {
  productId: string;
  hsCode: string;
  countryOfOriginCode: string | null;
  unitOfMeasure: string | null;
  quantity: string | null;
  /** Tariff snapshot of the product, or null when it has none. */
  snapshot: { customsDutyRate: string | null } | null;
};

export type PlannedGroup = {
  /** 1-based; the group code is GRP-00<sequence>. */
  sequence: number;
  groupCode: string;
  key: GroupKey;
  productIds: string[];
  totalQuantity: number;
  groupingReason: string;
};

export type GroupingPlan = {
  groups: PlannedGroup[];
  productCount: number;
  /** Changes whenever the groups or their members change. */
  planKey: string;
};

export function buildTaxProfileHash(
  snapshots: Array<{ customsDutyRate: string | null }>,
): string {
  const rates = snapshots
    .map((s) => s.customsDutyRate ?? "0")
    .sort()
    .join("|");
  return createHash("sha256").update(rates).digest("hex").slice(0, 32);
}

export function groupKeyString(key: GroupKey): string {
  return [
    key.hsCode,
    key.countryOfOriginCode,
    key.procedureCode,
    key.taxProfileHash,
    key.unitOfMeasure,
  ].join("::");
}

export function groupCodeFor(sequence: number): string {
  return `GRP-${String(sequence).padStart(3, "0")}`;
}

export function buildGroupingPlan(
  inputs: GroupingInput[],
  context: { caseCountryOfOriginCode: string | null; procedureCode: string },
): GroupingPlan {
  const buckets = new Map<string, { key: GroupKey; items: GroupingInput[] }>();

  for (const item of inputs) {
    const key: GroupKey = {
      hsCode: item.hsCode,
      countryOfOriginCode:
        item.countryOfOriginCode ?? context.caseCountryOfOriginCode ?? "UNK",
      procedureCode: context.procedureCode,
      taxProfileHash: buildTaxProfileHash(item.snapshot ? [item.snapshot] : []),
      unitOfMeasure: item.unitOfMeasure ?? "PCS",
    };
    const keyStr = groupKeyString(key);
    const bucket = buckets.get(keyStr);
    if (bucket) bucket.items.push(item);
    else buckets.set(keyStr, { key, items: [item] });
  }

  const groups: PlannedGroup[] = [];
  let sequence = 0;
  for (const bucket of buckets.values()) {
    sequence += 1;
    const totalQuantity = bucket.items.reduce(
      (sum, i) => sum + (Number.parseFloat(i.quantity ?? "0") || 0),
      0,
    );
    groups.push({
      sequence,
      groupCode: groupCodeFor(sequence),
      key: bucket.key,
      productIds: bucket.items.map((i) => i.productId),
      totalQuantity,
      groupingReason: `${bucket.items.length} product(s), total qty ${totalQuantity}`,
    });
  }

  return {
    groups,
    productCount: inputs.length,
    planKey: stableHash(
      groups.map(
        (g) => `${g.groupCode}:${groupKeyString(g.key)}:${g.productIds.join(",")}`,
      ),
    ),
  };
}