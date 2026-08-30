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
}) {
  const conditions = [eq(importCases.tenantId, params.tenantId)];

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
        importerName: importCases.importerName,
        supplierName: importCases.supplierName,
        shipmentReference: importCases.shipmentReference,
        assignedAgentId: importCases.assignedAgentId,
        assignedAgentName: users.fullName,
        assignedAgentEmail: users.email,
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
    })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.status, "active")))
    .orderBy(users.fullName);
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
