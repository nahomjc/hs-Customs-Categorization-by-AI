import { and, asc, count, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { suppliers, type SupplierRow } from "@/db/schema";

export type SupplierListItem = {
  id: string;
  name: string;
  countryCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function searchSuppliers(params: {
  tenantId: string;
  query?: string;
  limit?: number;
}): Promise<SupplierListItem[]> {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
  const conditions = [eq(suppliers.tenantId, params.tenantId)];
  if (params.query?.trim()) {
    conditions.push(ilike(suppliers.name, `%${params.query.trim()}%`));
  }

  return db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      countryCode: suppliers.countryCode,
      createdAt: suppliers.createdAt,
      updatedAt: suppliers.updatedAt,
    })
    .from(suppliers)
    .where(and(...conditions))
    .orderBy(asc(suppliers.name))
    .limit(limit);
}

export async function listSuppliers(params: {
  tenantId: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: SupplierListItem[]; total: number }> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);
  const conditions = [eq(suppliers.tenantId, params.tenantId)];
  if (params.search?.trim()) {
    conditions.push(ilike(suppliers.name, `%${params.search.trim()}%`));
  }
  const where = and(...conditions);

  const [items, totalRow] = await Promise.all([
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        countryCode: suppliers.countryCode,
        createdAt: suppliers.createdAt,
        updatedAt: suppliers.updatedAt,
      })
      .from(suppliers)
      .where(where)
      .orderBy(asc(suppliers.name))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(suppliers).where(where),
  ]);

  return { items, total: totalRow[0]?.count ?? 0 };
}

export async function getSupplierById(
  tenantId: string,
  id: string,
): Promise<SupplierRow | null> {
  const [row] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, id), eq(suppliers.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

async function findSupplierByName(
  tenantId: string,
  name: string,
): Promise<SupplierRow | null> {
  const [row] = await db
    .select()
    .from(suppliers)
    .where(
      and(
        eq(suppliers.tenantId, tenantId),
        sql`lower(${suppliers.name}) = lower(${name})`,
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findOrCreateSupplier(
  tenantId: string,
  name: string,
  countryCode?: string | null,
): Promise<SupplierRow> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Supplier name is required");
  }

  const existing = await findSupplierByName(tenantId, trimmed);
  if (existing) {
    if (
      countryCode?.trim() &&
      !existing.countryCode &&
      countryCode.trim() !== existing.countryCode
    ) {
      const [updated] = await db
        .update(suppliers)
        .set({
          countryCode: countryCode.trim().toUpperCase(),
          updatedAt: new Date(),
        })
        .where(eq(suppliers.id, existing.id))
        .returning();
      return updated ?? existing;
    }
    return existing;
  }

  try {
    const [created] = await db
      .insert(suppliers)
      .values({
        tenantId,
        name: trimmed,
        countryCode: countryCode?.trim()
          ? countryCode.trim().toUpperCase()
          : null,
      })
      .returning();
    if (!created) throw new Error("Failed to create supplier");
    return created;
  } catch (error) {
    const code =
      error &&
      typeof error === "object" &&
      "cause" in error &&
      error.cause &&
      typeof error.cause === "object" &&
      "code" in error.cause
        ? String(error.cause.code)
        : null;
    if (code === "23505") {
      const again = await findSupplierByName(tenantId, trimmed);
      if (again) return again;
    }
    throw error;
  }
}

/** Resolve supplierId / supplierName for import case create/update. */
export async function resolveSupplierForCase(
  tenantId: string,
  input: {
    supplierId?: string | null;
    supplierName?: string | null;
    supplierCountryCode?: string | null;
  },
): Promise<{
  supplierId: string | null;
  supplierName: string | null;
  supplierCountryCode: string | null;
}> {
  if (input.supplierId) {
    const row = await getSupplierById(tenantId, input.supplierId);
    if (!row) {
      throw new Error("Supplier not found");
    }
    return {
      supplierId: row.id,
      supplierName: row.name,
      supplierCountryCode:
        input.supplierCountryCode?.trim() || row.countryCode || null,
    };
  }

  const name = input.supplierName?.trim();
  if (!name) {
    return {
      supplierId: null,
      supplierName: null,
      supplierCountryCode: input.supplierCountryCode?.trim() || null,
    };
  }

  const row = await findOrCreateSupplier(
    tenantId,
    name,
    input.supplierCountryCode,
  );
  return {
    supplierId: row.id,
    supplierName: row.name,
    supplierCountryCode:
      input.supplierCountryCode?.trim() || row.countryCode || null,
  };
}
