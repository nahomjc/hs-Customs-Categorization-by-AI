import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { importColumnMappings } from "@/db/schema";
import type { MappingDocKind, SavedColumnMapping } from "./column-mapping";

export async function getSavedColumnMapping(
  tenantId: string,
  kind: MappingDocKind,
  headerSignature: string,
): Promise<SavedColumnMapping | null> {
  const [row] = await db
    .select({ mapping: importColumnMappings.mapping })
    .from(importColumnMappings)
    .where(
      and(
        eq(importColumnMappings.tenantId, tenantId),
        eq(importColumnMappings.documentType, kind),
        eq(importColumnMappings.headerSignature, headerSignature),
      ),
    )
    .limit(1);
  if (!row?.mapping || typeof row.mapping !== "object") return null;
  return row.mapping as SavedColumnMapping;
}

export async function saveColumnMapping(params: {
  tenantId: string;
  kind: MappingDocKind;
  headerSignature: string;
  headers: string[];
  mapping: SavedColumnMapping;
  supplierName?: string | null;
  userId?: string | null;
}): Promise<void> {
  const now = new Date();
  await db
    .insert(importColumnMappings)
    .values({
      tenantId: params.tenantId,
      documentType: params.kind,
      headerSignature: params.headerSignature,
      headers: params.headers,
      mapping: params.mapping,
      supplierName: params.supplierName ?? null,
      createdBy: params.userId ?? null,
    })
    .onConflictDoUpdate({
      target: [
        importColumnMappings.tenantId,
        importColumnMappings.documentType,
        importColumnMappings.headerSignature,
      ],
      set: {
        headers: params.headers,
        mapping: params.mapping,
        supplierName: params.supplierName ?? null,
        updatedAt: now,
      },
    });
}
