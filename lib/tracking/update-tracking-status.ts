import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { importCases, trackingStatusEvents } from "@/db/schema";
import { writeAuditLog } from "@/lib/import-cases/queries";
import { notifyClientTrackingUpdate } from "@/lib/notifications/notify-tracking";
import {
  isTrackingStatus,
  type TrackingSource,
  type TrackingStatus,
} from "@/lib/tracking/constants";

export type UpdateTrackingStatusInput = {
  tenantId: string;
  importCaseId?: string;
  caseNumber?: string;
  status: string;
  note?: string | null;
  source: TrackingSource;
  actorUserId?: string | null;
};

export type UpdateTrackingStatusResult =
  | { ok: true; importCaseId: string; caseNumber: string; status: TrackingStatus }
  | { ok: false; error: string };

export async function updateTrackingStatus(
  input: UpdateTrackingStatusInput,
): Promise<UpdateTrackingStatusResult> {
  if (!isTrackingStatus(input.status)) {
    return { ok: false, error: `Invalid tracking status: ${input.status}` };
  }

  const conditions = [eq(importCases.tenantId, input.tenantId)];
  if (input.importCaseId) {
    conditions.push(eq(importCases.id, input.importCaseId));
  } else if (input.caseNumber) {
    conditions.push(eq(importCases.caseNumber, input.caseNumber));
  } else {
    return { ok: false, error: "Case id or case number is required" };
  }

  const [existing] = await db
    .select()
    .from(importCases)
    .where(and(...conditions))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Import case not found" };
  }

  const now = new Date();
  const note = input.note?.trim() || null;

  const [updated] = await db
    .update(importCases)
    .set({
      trackingStatus: input.status,
      trackingNote: note,
      trackingUpdatedAt: now,
      trackingUpdatedByUserId: input.actorUserId ?? null,
      updatedAt: now,
    })
    .where(eq(importCases.id, existing.id))
    .returning();

  if (!updated) {
    return { ok: false, error: "Failed to update tracking status" };
  }

  await db.insert(trackingStatusEvents).values({
    tenantId: input.tenantId,
    importCaseId: existing.id,
    status: input.status,
    note,
    source: input.source,
    createdByUserId: input.actorUserId ?? null,
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    importCaseId: existing.id,
    userId: input.actorUserId ?? null,
    entityType: "import_case",
    entityId: existing.id,
    action: "tracking_status_updated",
    oldData: {
      trackingStatus: existing.trackingStatus,
      trackingNote: existing.trackingNote,
    },
    newData: {
      trackingStatus: input.status,
      trackingNote: note,
      source: input.source,
    },
  });

  if (updated.clientUserId) {
    await notifyClientTrackingUpdate({
      tenantId: input.tenantId,
      importCaseId: updated.id,
      caseNumber: updated.caseNumber,
      clientUserId: updated.clientUserId,
      status: input.status,
      note,
    });
  }

  return {
    ok: true,
    importCaseId: updated.id,
    caseNumber: updated.caseNumber,
    status: input.status,
  };
}

export async function recordInitialTrackingEvent(params: {
  tenantId: string;
  importCaseId: string;
  actorUserId: string;
  clientUserId?: string | null;
  caseNumber: string;
}) {
  await db.insert(trackingStatusEvents).values({
    tenantId: params.tenantId,
    importCaseId: params.importCaseId,
    status: "received",
    note: null,
    source: "system",
    createdByUserId: params.actorUserId,
  });

  if (params.clientUserId) {
    await notifyClientTrackingUpdate({
      tenantId: params.tenantId,
      importCaseId: params.importCaseId,
      caseNumber: params.caseNumber,
      clientUserId: params.clientUserId,
      status: "received",
      note: null,
    });
  }
}
