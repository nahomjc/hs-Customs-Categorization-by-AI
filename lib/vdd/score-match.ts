import type { VddReferenceRecordRow } from "@/db/schema/vddReferenceRecords";
import type { VddSearchProfile } from "./search-profile";

/** Max raw points from the deterministic scoring table. */
export const VDD_SCORE_MAX_POINTS = 105;

export type VddScoredMatch = {
  record: VddReferenceRecordRow;
  similarityScore: number;
  matchReasons: string[];
  differences: string[];
  points: number;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function unitsEqual(a: string | null, b: string | null): boolean {
  const na = norm(a).replace(/s$/, "");
  const nb = norm(b).replace(/s$/, "");
  if (!na || !nb) return false;
  if (na === nb) return true;
  const aliases: Record<string, string> = {
    pcs: "pc",
    piece: "pc",
    pieces: "pc",
    kg: "kg",
    kilogram: "kg",
    kilograms: "kg",
  };
  return (aliases[na] ?? na) === (aliases[nb] ?? nb);
}

function tokenOverlap(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const ta = new Set(a.split(" ").filter((t) => t.length > 2));
  const tb = b.split(" ").filter((t) => t.length > 2);
  if (ta.size === 0 || tb.length === 0) return false;
  const hits = tb.filter((t) => ta.has(t)).length;
  return hits >= Math.min(2, tb.length);
}

/**
 * Deterministic similarity scoring (plan points → 0–1).
 * Exact model +35, brand +20, common/product name +20, type +10,
 * origin +5, unit +5, condition +5, material +5.
 */
export function scoreVddMatch(
  profile: VddSearchProfile,
  record: VddReferenceRecordRow,
): VddScoredMatch {
  let points = 0;
  const matchReasons: string[] = [];
  const differences: string[] = [];

  const pModel = norm(profile.model);
  const rModel = norm(record.model);
  if (pModel && rModel) {
    if (pModel === rModel) {
      points += 35;
      matchReasons.push("Exact model match");
    } else {
      differences.push(`Model differs (${profile.model} vs ${record.model})`);
    }
  } else if (pModel && !rModel) {
    differences.push("VDD record missing model");
  }

  const pBrand = norm(profile.brand);
  const rBrand = norm(record.brandOrMake);
  if (pBrand && rBrand) {
    if (pBrand === rBrand) {
      points += 20;
      matchReasons.push("Exact brand match");
    } else {
      differences.push(
        `Brand differs (${profile.brand} vs ${record.brandOrMake})`,
      );
    }
  }

  const pName = norm(profile.productName ?? profile.description);
  const rName = norm(record.commonName ?? record.commercialDescription);
  if (pName && rName) {
    if (tokenOverlap(pName, rName)) {
      points += 20;
      matchReasons.push("Same common/product name");
    } else {
      differences.push("Product name / description differs");
    }
  }

  const pType = norm(profile.productType);
  const rType = norm(record.productType);
  if (pType && rType) {
    if (pType === rType || tokenOverlap(pType, rType)) {
      points += 10;
      matchReasons.push("Same product type");
    } else {
      differences.push(`Type differs (${profile.productType} vs ${record.productType})`);
    }
  }

  const pOrigin = norm(profile.originCode);
  const rOrigin = norm(record.originCode);
  if (pOrigin && rOrigin) {
    if (pOrigin === rOrigin) {
      points += 5;
      matchReasons.push("Same origin country");
    } else {
      differences.push(
        `Origin differs (${profile.originCode} vs ${record.originCode})`,
      );
    }
  }

  if (unitsEqual(profile.unitOfMeasure, record.unitOfQuantity)) {
    points += 5;
    matchReasons.push("Same unit");
  } else if (profile.unitOfMeasure && record.unitOfQuantity) {
    differences.push(
      `Unit differs (${profile.unitOfMeasure} vs ${record.unitOfQuantity})`,
    );
  }

  const pCond = norm(profile.condition);
  const rCond = norm(record.condition);
  if (pCond && rCond) {
    if (pCond === rCond || (pCond === "new" && rCond.includes("new"))) {
      points += 5;
      matchReasons.push("Same condition");
    } else {
      differences.push("Condition differs");
    }
  }

  const pMat = norm(profile.material);
  const rMat = norm(record.material);
  if (pMat && rMat) {
    if (pMat === rMat || tokenOverlap(pMat, rMat)) {
      points += 5;
      matchReasons.push("Same material");
    } else {
      differences.push("Material differs");
    }
  }

  const similarityScore = Math.min(
    1,
    Math.round((points / VDD_SCORE_MAX_POINTS) * 10000) / 10000,
  );

  return {
    record,
    similarityScore,
    matchReasons,
    differences,
    points,
  };
}
