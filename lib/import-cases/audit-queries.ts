import { db } from "@/db";
import { auditLogs, importCases, users } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export type AuditLogView = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  importCaseId: string | null;
  caseNumber: string | null;
  userId: string | null;
  userFullName: string | null;
  userEmail: string | null;
  reason: string | null;
  newData: Record<string, unknown> | null;
  createdAt: Date;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function getCaseAuditLogs(
  caseId: string,
  tenantId: string,
  limit = 100,
): Promise<AuditLogView[]> {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      importCaseId: auditLogs.importCaseId,
      caseNumber: importCases.caseNumber,
      userId: auditLogs.userId,
      userFullName: users.fullName,
      userEmail: users.email,
      reason: auditLogs.reason,
      newData: auditLogs.newData,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(importCases, eq(auditLogs.importCaseId, importCases.id))
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(
      and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.importCaseId, caseId)),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    newData: toRecord(row.newData),
  }));
}

export async function getUserAuditLogs(
  userId: string,
  tenantId: string,
  limit = 100,
): Promise<AuditLogView[]> {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      importCaseId: auditLogs.importCaseId,
      caseNumber: importCases.caseNumber,
      userId: auditLogs.userId,
      userFullName: users.fullName,
      userEmail: users.email,
      reason: auditLogs.reason,
      newData: auditLogs.newData,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(importCases, eq(auditLogs.importCaseId, importCases.id))
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.userId, userId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    newData: toRecord(row.newData),
  }));
}
