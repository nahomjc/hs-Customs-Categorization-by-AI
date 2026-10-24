import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { importCases, importProducts, notifications } from "@/db/schema";
import type { ClientShipmentSummary } from "@/components/dashboard/client/ClientShipmentCard";
import { getTenantId } from "@/lib/import-cases/queries";

/** Product names kept per case for search (keeps the payload small). */
const PRODUCT_NAMES_PER_CASE = 12;
const PRODUCT_NAME_MAX_LENGTH = 80;
/** Safety cap on product rows read for search across all of a client's cases. */
const PRODUCT_ROWS_CAP = 3000;

export async function listClientShipments(
  clientUserId: string,
): Promise<ClientShipmentSummary[]> {
  const tenantId = getTenantId();
  const cases = await db
    .select({
      id: importCases.id,
      caseNumber: importCases.caseNumber,
      trackingStatus: importCases.trackingStatus,
      trackingNote: importCases.trackingNote,
      trackingUpdatedAt: importCases.trackingUpdatedAt,
      supplierName: importCases.supplierName,
      shipmentReference: importCases.shipmentReference,
      updatedAt: importCases.updatedAt,
      createdAt: importCases.createdAt,
      supplierCountryCode: importCases.supplierCountryCode,
      countryOfExportCode: importCases.countryOfExportCode,
      countryOfOriginCode: importCases.countryOfOriginCode,
      billOfLadingNumber: importCases.billOfLadingNumber,
      airwayBillNumber: importCases.airwayBillNumber,
      incoterm: importCases.incoterm,
      invoiceCurrencyCode: importCases.invoiceCurrencyCode,
      invoiceTotalAmount: importCases.invoiceTotalAmount,
    })
    .from(importCases)
    .where(
      and(
        eq(importCases.tenantId, tenantId),
        eq(importCases.clientUserId, clientUserId),
      ),
    )
    .orderBy(desc(importCases.updatedAt));

  if (cases.length === 0) return [];

  const ids = cases.map((c) => c.id);
  const [counts, names] = await Promise.all([
    db
      .select({ caseId: importProducts.importCaseId, total: count() })
      .from(importProducts)
      .where(inArray(importProducts.importCaseId, ids))
      .groupBy(importProducts.importCaseId),
    db
      .select({
        caseId: importProducts.importCaseId,
        productName: importProducts.productName,
        rawDescription: importProducts.rawDescription,
      })
      .from(importProducts)
      .where(inArray(importProducts.importCaseId, ids))
      .orderBy(
        asc(importProducts.importCaseId),
        asc(importProducts.productSequence),
      )
      .limit(PRODUCT_ROWS_CAP),
  ]);

  const countByCase = new Map(counts.map((r) => [r.caseId, Number(r.total)]));
  const namesByCase = new Map<string, string[]>();
  for (const row of names) {
    const list = namesByCase.get(row.caseId) ?? [];
    if (list.length >= PRODUCT_NAMES_PER_CASE) continue;
    const label = (row.productName ?? row.rawDescription ?? "").trim();
    if (!label) continue;
    list.push(label.slice(0, PRODUCT_NAME_MAX_LENGTH));
    namesByCase.set(row.caseId, list);
  }

  return cases.map((c) => ({
    ...c,
    productCount: countByCase.get(c.id) ?? 0,
    productNames: namesByCase.get(c.id) ?? [],
  }));
}

export async function listClientNotifications(
  userId: string,
  limit = 8,
) {
  return db
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      read: notifications.read,
      createdAt: notifications.createdAt,
      importCaseId: notifications.importCaseId,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
