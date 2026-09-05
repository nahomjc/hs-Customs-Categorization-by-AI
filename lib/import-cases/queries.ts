import { db } from "@/db";
import {
  auditLogs,
  importCaseDocuments,
  importCases,
  invoiceLines,
  packingListLines,
  users,
} from "@/db/schema";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
} from "drizzle-orm";
import type { ImportCaseStatus } from "./constants";
import { countOpenChecks } from "./run-case-checks";

export function getTenantId(): string {
  return DEFAULT_TENANT_ID;
}

export async function getImportCaseById(caseId: string, tenantId: string) {
  const [row] = await db
    .select()
    .from(importCases)
    .where(and(eq(importCases.id, caseId), eq(importCases.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function listImportCases(params: {
  tenantId: string;
  search?: string;
  status?: ImportCaseStatus;
  limit: number;
  offset: number;
  clientUserId?: string;
}) {
  const conditions = [eq(importCases.tenantId, params.tenantId)];

  if (params.clientUserId) {
    conditions.push(eq(importCases.clientUserId, params.clientUserId));
  }

  if (params.status) {
    conditions.push(eq(importCases.status, params.status));
  }

  if (params.search) {
    const term = `%${params.search}%`;
    conditions.push(
      or(
        ilike(importCases.caseNumber, term),
        ilike(importCases.importerName, term),
        ilike(importCases.supplierName, term),
        ilike(importCases.shipmentReference, term),
      )!,
    );
  }

  const where = and(...conditions);

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: importCases.id,
        caseNumber: importCases.caseNumber,
        status: importCases.status,
        trackingStatus: importCases.trackingStatus,
        importerName: importCases.importerName,
        supplierName: importCases.supplierName,
        shipmentReference: importCases.shipmentReference,
        assignedAgentId: importCases.assignedAgentId,
        assignedAgentName: users.fullName,
        assignedAgentEmail: users.email,
        clientUserId: importCases.clientUserId,
        createdAt: importCases.createdAt,
        updatedAt: importCases.updatedAt,
      })
      .from(importCases)
      .leftJoin(users, eq(importCases.assignedAgentId, users.id))
      .where(where)
      .orderBy(desc(importCases.updatedAt))
      .limit(params.limit)
      .offset(params.offset),
    db
      .select({ count: count() })
      .from(importCases)
      .where(where),
  ]);

  return {
    items: await Promise.all(
      rows.map(async (row) => ({
        ...row,
        openCheckCount: await countOpenChecks(row.id),
      })),
    ),
    total: totalRow[0]?.count ?? 0,
  };
}

export async function getCaseDocuments(caseId: string) {
  return db
    .select()
    .from(importCaseDocuments)
    .where(eq(importCaseDocuments.importCaseId, caseId))
    .orderBy(desc(importCaseDocuments.createdAt));
}

export async function getCaseDocument(
  caseId: string,
  documentId: string,
) {
  const [row] = await db
    .select()
    .from(importCaseDocuments)
    .where(
      and(
        eq(importCaseDocuments.id, documentId),
        eq(importCaseDocuments.importCaseId, caseId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getInvoiceLines(caseId: string) {
  return db
    .select({
      line: invoiceLines,
      documentName: importCaseDocuments.originalFileName,
      documentType: importCaseDocuments.documentType,
    })
    .from(invoiceLines)
    .innerJoin(
      importCaseDocuments,
      eq(invoiceLines.documentId, importCaseDocuments.id),
    )
    .where(eq(invoiceLines.importCaseId, caseId))
    .orderBy(invoiceLines.lineNumber);
}

export async function getPackingListLines(caseId: string) {
  return db
    .select({
      line: packingListLines,
      documentName: importCaseDocuments.originalFileName,
      documentType: importCaseDocuments.documentType,
    })
    .from(packingListLines)
    .innerJoin(
      importCaseDocuments,
      eq(packingListLines.documentId, importCaseDocuments.id),
    )
    .where(eq(packingListLines.importCaseId, caseId))
    .orderBy(packingListLines.lineNumber);
}

export async function getNextLineNumber(
  documentId: string,
  table: "invoice" | "packing",
): Promise<number> {
  if (table === "invoice") {
    const [row] = await db
      .select({ max: sql<number>`COALESCE(MAX(${invoiceLines.lineNumber}), 0)` })
      .from(invoiceLines)
      .where(eq(invoiceLines.documentId, documentId));
    return (row?.max ?? 0) + 1;
  }

  const [row] = await db
    .select({
      max: sql<number>`COALESCE(MAX(${packingListLines.lineNumber}), 0)`,
    })
    .from(packingListLines)
    .where(eq(packingListLines.documentId, documentId));
  return (row?.max ?? 0) + 1;
}

export async function listTenantUsers(tenantId: string) {
  return db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      phone: users.phone,
    })
    .from(users)
    .where(
      and(
        eq(users.tenantId, tenantId),
        eq(users.status, "active"),
        sql`${users.role} <> 'client'`,
      ),
    )
    .orderBy(users.fullName);
}

export async function searchTenantClients(params: {
  tenantId: string;
  query?: string;
  limit?: number;
}) {
  const limit = params.limit ?? 20;
  const conditions = [
    eq(users.tenantId, params.tenantId),
    eq(users.status, "active"),
    eq(users.role, "client"),
  ];

  if (params.query?.trim()) {
    const term = `%${params.query.trim()}%`;
    conditions.push(
      or(
        ilike(users.fullName, term),
        ilike(users.email, term),
        ilike(users.phone, term),
      )!,
    );
  }

  return db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(users.fullName)
    .limit(limit);
}

export type WriteAuditLogParams = {
  tenantId: string;
  importCaseId?: string | null;
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function writeAuditLog(params: WriteAuditLogParams) {
  await db.insert(auditLogs).values({
    tenantId: params.tenantId,
    importCaseId: params.importCaseId ?? null,
    userId: params.userId ?? null,
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    oldData: params.oldData ?? null,
    newData: params.newData ?? null,
    reason: params.reason ?? null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
  });
}
