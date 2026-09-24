import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  vddReferenceRecords,
  type VddReferenceRecordInsert,
  type VddReferenceRecordRow,
} from "@/db/schema";
import { buildVddDedupeKey } from "./fingerprint";
import type { VddParsedRecord } from "./import-vdd-xlsx";

export type VddUpsertStats = {
  inserted: number;
  updated: number;
  skipped: number;
};

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length === 0;
  }
  return false;
}

function fillString(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): string | null {
  if (!isEmptyValue(existing)) return existing ?? null;
  if (isEmptyValue(incoming)) return existing ?? null;
  return incoming ?? null;
}

function mergeExtraAttributes(
  existing: unknown,
  incoming: Record<string, string>,
): Record<string, string> {
  const base: Record<string, string> =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, string>) }
      : {};
  for (const [key, value] of Object.entries(incoming)) {
    if (!value?.trim()) continue;
    if (isEmptyValue(base[key])) {
      base[key] = value.trim();
    }
  }
  return base;
}

function recordNeedsFill(
  existing: VddReferenceRecordRow,
  incoming: VddParsedRecord,
): boolean {
  const stringFields: Array<[string | null | undefined, string | null | undefined]> = [
    [existing.importerName, incoming.importerName],
    [existing.declarationNumber, incoming.declarationNumber],
    [existing.unitOfQuantity, incoming.unitOfQuantity],
    [existing.originCode, incoming.originCode],
    [existing.countryName, incoming.countryName],
    [existing.brandOrMake, incoming.brandOrMake],
    [existing.model, incoming.model],
    [existing.commonName, incoming.commonName],
    [existing.condition, incoming.condition],
    [existing.commercialDescription, incoming.commercialDescription],
    [existing.appearance, incoming.appearance],
    [existing.material, incoming.material],
    [existing.size, incoming.size],
    [existing.productType, incoming.productType],
    [existing.declaredUnitPrice, incoming.declaredUnitPrice],
    [existing.netMass, incoming.netMass],
    [existing.grossMass, incoming.grossMass],
    [existing.diameter, incoming.diameter],
    [existing.width, incoming.width],
    [existing.length, incoming.length],
  ];
  for (const [ex, inc] of stringFields) {
    if (isEmptyValue(ex) && !isEmptyValue(inc)) return true;
  }
  for (const [key, value] of Object.entries(incoming.extraAttributes)) {
    if (!value?.trim()) continue;
    const extras =
      existing.extraAttributes &&
      typeof existing.extraAttributes === "object" &&
      !Array.isArray(existing.extraAttributes)
        ? (existing.extraAttributes as Record<string, string>)
        : {};
    if (isEmptyValue(extras[key])) return true;
  }
  return false;
}

function buildFilledUpdate(
  existing: VddReferenceRecordRow,
  incoming: VddParsedRecord,
): Partial<VddReferenceRecordInsert> {
  return {
    importerName: fillString(existing.importerName, incoming.importerName),
    declarationNumber: fillString(
      existing.declarationNumber,
      incoming.declarationNumber,
    ),
    unitOfQuantity: fillString(existing.unitOfQuantity, incoming.unitOfQuantity),
    originCode: fillString(existing.originCode, incoming.originCode),
    countryName: fillString(existing.countryName, incoming.countryName),
    brandOrMake: fillString(existing.brandOrMake, incoming.brandOrMake),
    model: fillString(existing.model, incoming.model),
    commonName: fillString(existing.commonName, incoming.commonName),
    condition: fillString(existing.condition, incoming.condition),
    commercialDescription: fillString(
      existing.commercialDescription,
      incoming.commercialDescription,
    ),
    appearance: fillString(existing.appearance, incoming.appearance),
    material: fillString(existing.material, incoming.material),
    size: fillString(existing.size, incoming.size),
    productType: fillString(existing.productType, incoming.productType),
    diameter: fillString(existing.diameter, incoming.diameter),
    width: fillString(existing.width, incoming.width),
    length: fillString(existing.length, incoming.length),
    declaredUnitPrice: fillString(
      existing.declaredUnitPrice,
      incoming.declaredUnitPrice,
    ),
    netMass: fillString(existing.netMass, incoming.netMass),
    grossMass: fillString(existing.grossMass, incoming.grossMass),
    currencyCode: existing.currencyCode || incoming.currencyCode || "USD",
    normalizedText: fillString(existing.normalizedText, incoming.normalizedText),
    extraAttributes: mergeExtraAttributes(
      existing.extraAttributes,
      incoming.extraAttributes,
    ),
    // Keep the richer of the two quality flag lists
    dataQualityFlags:
      Array.isArray(existing.dataQualityFlags) &&
      (existing.dataQualityFlags as string[]).length > 0
        ? existing.dataQualityFlags
        : incoming.dataQualityFlags,
  };
}

function toInsertRow(
  record: VddParsedRecord,
  opts: {
    tenantId: string;
    batchId: string;
    sourceFileName: string;
    dedupeKey: string;
  },
): VddReferenceRecordInsert {
  return {
    tenantId: opts.tenantId,
    importBatchId: opts.batchId,
    sourceFileName: opts.sourceFileName,
    sourceRowNumber: record.sourceRowNumber,
    importerName: record.importerName,
    declarationNumber: record.declarationNumber,
    hsCode: record.hsCode,
    unitOfQuantity: record.unitOfQuantity,
    originCode: record.originCode,
    countryName: record.countryName,
    brandOrMake: record.brandOrMake,
    model: record.model,
    commonName: record.commonName,
    condition: record.condition,
    commercialDescription: record.commercialDescription,
    appearance: record.appearance,
    material: record.material,
    size: record.size,
    productType: record.productType,
    diameter: record.diameter,
    width: record.width,
    length: record.length,
    declaredUnitPrice: record.declaredUnitPrice,
    netMass: record.netMass,
    grossMass: record.grossMass,
    currencyCode: record.currencyCode,
    normalizedText: record.normalizedText,
    normalizedData: record.normalizedData,
    rawRow: record.rawRow,
    extraAttributes: record.extraAttributes,
    dataQualityFlags: record.dataQualityFlags,
    dedupeKey: opts.dedupeKey,
  };
}

/**
 * Insert new VDD rows; skip exact duplicates; fill empty fields on soft matches.
 * Same HS with different brand/model/declaration stays as separate rows.
 */
export async function upsertVddParsedRecords(opts: {
  tenantId: string;
  batchId: string;
  sourceFileName: string;
  records: VddParsedRecord[];
}): Promise<VddUpsertStats> {
  const stats: VddUpsertStats = { inserted: 0, updated: 0, skipped: 0 };
  if (opts.records.length === 0) return stats;

  const keyed = opts.records.map((r) => ({
    record: r,
    dedupeKey: buildVddDedupeKey(r),
  }));

  // Dedupe within this file first (keep first occurrence, merge later rows into it in memory)
  const withinFile = new Map<string, VddParsedRecord>();
  for (const { record, dedupeKey } of keyed) {
    const prev = withinFile.get(dedupeKey);
    if (!prev) {
      withinFile.set(dedupeKey, record);
      continue;
    }
    // Prefer filled values from later rows onto the kept row
    const mergedExtras = mergeExtraAttributes(
      prev.extraAttributes,
      record.extraAttributes,
    );
    withinFile.set(dedupeKey, {
      ...prev,
      importerName: fillString(prev.importerName, record.importerName),
      declarationNumber: fillString(
        prev.declarationNumber,
        record.declarationNumber,
      ),
      unitOfQuantity: fillString(prev.unitOfQuantity, record.unitOfQuantity),
      originCode: fillString(prev.originCode, record.originCode),
      countryName: fillString(prev.countryName, record.countryName),
      brandOrMake: fillString(prev.brandOrMake, record.brandOrMake),
      model: fillString(prev.model, record.model),
      commonName: fillString(prev.commonName, record.commonName),
      condition: fillString(prev.condition, record.condition),
      commercialDescription: fillString(
        prev.commercialDescription,
        record.commercialDescription,
      ),
      appearance: fillString(prev.appearance, record.appearance),
      material: fillString(prev.material, record.material),
      size: fillString(prev.size, record.size),
      productType: fillString(prev.productType, record.productType),
      diameter: fillString(prev.diameter, record.diameter),
      width: fillString(prev.width, record.width),
      length: fillString(prev.length, record.length),
      declaredUnitPrice: fillString(
        prev.declaredUnitPrice,
        record.declaredUnitPrice,
      ),
      netMass: fillString(prev.netMass, record.netMass),
      grossMass: fillString(prev.grossMass, record.grossMass),
      extraAttributes: mergedExtras,
    });
    stats.skipped += 1;
  }

  const uniqueRecords = [...withinFile.entries()];
  const dedupeKeys = uniqueRecords.map(([k]) => k);

  const existingRows =
    dedupeKeys.length === 0
      ? []
      : await db
          .select()
          .from(vddReferenceRecords)
          .where(
            and(
              eq(vddReferenceRecords.tenantId, opts.tenantId),
              inArray(vddReferenceRecords.dedupeKey, dedupeKeys),
            ),
          );

  const existingByKey = new Map(
    existingRows
      .filter((r) => r.dedupeKey)
      .map((r) => [r.dedupeKey as string, r]),
  );

  const toInsert: VddReferenceRecordInsert[] = [];

  for (const [dedupeKey, record] of uniqueRecords) {
    const existing = existingByKey.get(dedupeKey);
    if (!existing) {
      toInsert.push(
        toInsertRow(record, {
          tenantId: opts.tenantId,
          batchId: opts.batchId,
          sourceFileName: opts.sourceFileName,
          dedupeKey,
        }),
      );
      continue;
    }

    if (!recordNeedsFill(existing, record)) {
      stats.skipped += 1;
      continue;
    }

    const patch = buildFilledUpdate(existing, record);
    await db
      .update(vddReferenceRecords)
      .set(patch)
      .where(eq(vddReferenceRecords.id, existing.id));
    stats.updated += 1;
  }

  const chunkSize = 200;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);
    await db.insert(vddReferenceRecords).values(chunk);
    stats.inserted += chunk.length;
  }

  return stats;
}
