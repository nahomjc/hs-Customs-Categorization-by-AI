import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { importCases, notifications } from "@/db/schema";
import type { ClientShipmentSummary } from "@/components/dashboard/client/ClientShipmentCard";
import { getTenantId } from "@/lib/import-cases/queries";

export async function listClientShipments(
  clientUserId: string,
): Promise<ClientShipmentSummary[]> {
  const tenantId = getTenantId();
  return db
    .select({
      id: importCases.id,
      caseNumber: importCases.caseNumber,
      trackingStatus: importCases.trackingStatus,
      trackingNote: importCases.trackingNote,
      trackingUpdatedAt: importCases.trackingUpdatedAt,
      supplierName: importCases.supplierName,
      shipmentReference: importCases.shipmentReference,
      updatedAt: importCases.updatedAt,
    })
    .from(importCases)
    .where(
      and(
        eq(importCases.tenantId, tenantId),
        eq(importCases.clientUserId, clientUserId),
      ),
    )
    .orderBy(desc(importCases.updatedAt));
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
      createdAt: notifications.createdAt,
      importCaseId: notifications.importCaseId,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
