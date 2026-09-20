import { NextResponse } from "next/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
  type AnyColumn,
} from "drizzle-orm";
import { db } from "@/db";
import { vddImportBatches, vddReferenceRecords } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/require-admin";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";

export const runtime = "nodejs";

const SORT_COLUMNS = {
  hsCode: vddReferenceRecords.hsCode,
  brandOrMake: vddReferenceRecords.brandOrMake,
  model: vddReferenceRecords.model,
  originCode: vddReferenceRecords.originCode,
  declaredUnitPrice: vddReferenceRecords.declaredUnitPrice,
  sourceRowNumber: vddReferenceRecords.sourceRowNumber,
  createdAt: vddReferenceRecords.createdAt,
  commonName: vddReferenceRecords.commonName,
  sourceFileName: vddImportBatches.sourceFileName,
} as const;

type SortField = keyof typeof SORT_COLUMNS;

function collectExtraColumnKeys(
  batches: Array<{ extraColumns: unknown }>,
): string[] {
  const keys = new Set<string>();
  for (const batch of batches) {
    const cols = batch.extraColumns;
    if (!Array.isArray(cols)) continue;
    for (const col of cols) {
      if (typeof col === "string" && col.trim()) keys.add(col);
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const tenantId = admin.session.profile.tenantId ?? DEFAULT_TENANT_ID;
  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId")?.trim() || undefined;
  const q = searchParams.get("q")?.trim() || undefined;
  const originCode = searchParams.get("originCode")?.trim() || undefined;
  const brandOrMake = searchParams.get("brandOrMake")?.trim() || undefined;
  const sortByParam = searchParams.get("sortBy") ?? "createdAt";
  const sortBy: SortField =
    sortByParam in SORT_COLUMNS ? (sortByParam as SortField) : "createdAt";
  const sortOrder =
    searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
  const page = Math.max(
    Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
    1,
  );
  const pageSize = Math.min(
    Math.max(
      Number.parseInt(searchParams.get("pageSize") ?? "25", 10) || 25,
      1,
    ),
    100,
  );

  const filters = [eq(vddReferenceRecords.tenantId, tenantId)];
  if (batchId) {
    filters.push(eq(vddReferenceRecords.importBatchId, batchId));
  }
  if (originCode) {
    filters.push(eq(vddReferenceRecords.originCode, originCode));
  }
  if (brandOrMake) {
    filters.push(ilike(vddReferenceRecords.brandOrMake, `%${brandOrMake}%`));
  }
  if (q) {
    const pattern = `%${q}%`;
    filters.push(
      or(
        ilike(vddReferenceRecords.hsCode, pattern),
        ilike(vddReferenceRecords.commonName, pattern),
        ilike(vddReferenceRecords.commercialDescription, pattern),
        ilike(vddReferenceRecords.brandOrMake, pattern),
        ilike(vddReferenceRecords.model, pattern),
        ilike(vddReferenceRecords.importerName, pattern),
        ilike(vddReferenceRecords.declarationNumber, pattern),
        ilike(vddImportBatches.sourceFileName, pattern),
        sql`${vddReferenceRecords.extraAttributes}::text ilike ${pattern}`,
      )!,
    );
  }

  const whereClause = and(...filters);
  const sortColumn: AnyColumn = SORT_COLUMNS[sortBy];
  const orderExpr =
    sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const [totalRow] = await db
    .select({ value: count() })
    .from(vddReferenceRecords)
    .innerJoin(
      vddImportBatches,
      eq(vddReferenceRecords.importBatchId, vddImportBatches.id),
    )
    .where(whereClause);

  const total = Number(totalRow?.value ?? 0);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const rows = await db
    .select({
      id: vddReferenceRecords.id,
      importBatchId: vddReferenceRecords.importBatchId,
      sourceFileName: vddImportBatches.sourceFileName,
      sourceRowNumber: vddReferenceRecords.sourceRowNumber,
      hsCode: vddReferenceRecords.hsCode,
      commonName: vddReferenceRecords.commonName,
      commercialDescription: vddReferenceRecords.commercialDescription,
      brandOrMake: vddReferenceRecords.brandOrMake,
      model: vddReferenceRecords.model,
      originCode: vddReferenceRecords.originCode,
      countryName: vddReferenceRecords.countryName,
      unitOfQuantity: vddReferenceRecords.unitOfQuantity,
      declaredUnitPrice: vddReferenceRecords.declaredUnitPrice,
      currencyCode: vddReferenceRecords.currencyCode,
      material: vddReferenceRecords.material,
      appearance: vddReferenceRecords.appearance,
      condition: vddReferenceRecords.condition,
      importerName: vddReferenceRecords.importerName,
      declarationNumber: vddReferenceRecords.declarationNumber,
      extraAttributes: vddReferenceRecords.extraAttributes,
      dataQualityFlags: vddReferenceRecords.dataQualityFlags,
      createdAt: vddReferenceRecords.createdAt,
    })
    .from(vddReferenceRecords)
    .innerJoin(
      vddImportBatches,
      eq(vddReferenceRecords.importBatchId, vddImportBatches.id),
    )
    .where(whereClause)
    .orderBy(orderExpr, asc(vddReferenceRecords.sourceRowNumber))
    .limit(pageSize)
    .offset(offset);

  const originRows = await db
    .selectDistinct({ originCode: vddReferenceRecords.originCode })
    .from(vddReferenceRecords)
    .where(eq(vddReferenceRecords.tenantId, tenantId))
    .orderBy(asc(vddReferenceRecords.originCode))
    .limit(200);

  const origins = originRows
    .map((r) => r.originCode)
    .filter((v): v is string => Boolean(v && v.trim()));

  const recentBatches = await db
    .select({ extraColumns: vddImportBatches.extraColumns })
    .from(vddImportBatches)
    .where(eq(vddImportBatches.tenantId, tenantId))
    .orderBy(desc(vddImportBatches.createdAt))
    .limit(50);

  const extraColumnKeys = collectExtraColumnKeys(recentBatches);

  return NextResponse.json({
    ok: true,
    rows,
    total,
    page: safePage,
    pageSize,
    totalPages,
    batchId: batchId ?? null,
    q: q ?? "",
    originCode: originCode ?? "",
    brandOrMake: brandOrMake ?? "",
    sortBy,
    sortOrder,
    filterOptions: { origins, extraColumnKeys },
    disclaimer:
      "VDD references support review only. They do not determine the final HS code or customs value.",
  });
}
