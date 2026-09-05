import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { importCases, users } from "@/db/schema";
import { ensureUserProfile } from "@/lib/auth/ensure-profile";
import { isClientRole, isStaffRole } from "@/lib/auth/roles";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { getAuthUser } from "@/lib/auth/session";
import {
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/import-cases/api-helpers";
import { generateCaseNumber } from "@/lib/import-cases/case-number";
import {
  getTenantId,
  listImportCases,
  writeAuditLog,
} from "@/lib/import-cases/queries";
import {
  createImportCaseSchema,
  listImportCasesQuerySchema,
} from "@/lib/import-cases/validation";
import { recordInitialTrackingEvent } from "@/lib/tracking/update-tracking-status";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const session = await getSessionUserProfile();
  const role = session?.profile?.role ?? "user";

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listImportCasesQuerySchema.safeParse(params);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const tenantId = getTenantId();

  if (isClientRole(role)) {
    const result = await listImportCases({
      tenantId,
      search: parsed.data.search,
      status: parsed.data.status,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      clientUserId: user.id,
    });
    return NextResponse.json(result);
  }

  if (!isStaffRole(role)) return unauthorizedResponse();

  const result = await listImportCases({
    tenantId,
    search: parsed.data.search,
    status: parsed.data.status,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user?.id || !user.email) return unauthorizedResponse();

  const session = await getSessionUserProfile();
  if (!isStaffRole(session?.profile?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureUserProfile({
    id: user.id,
    email: user.email,
    fullName: user.name ?? null,
    avatarUrl: user.image ?? null,
  });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createImportCaseSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const tenantId = getTenantId();

  const [client] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(
      and(
        eq(users.id, parsed.data.clientUserId),
        eq(users.tenantId, tenantId),
        eq(users.status, "active"),
      ),
    )
    .limit(1);

  if (!client || !isClientRole(client.role)) {
    return NextResponse.json(
      { error: "Selected user must be an active client" },
      { status: 400 },
    );
  }

  let created: (typeof importCases.$inferSelect) | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    const caseNumber = await generateCaseNumber(tenantId);
    try {
      [created] = await db
        .insert(importCases)
        .values({
          tenantId,
          caseNumber,
          status: "draft",
          importerName: parsed.data.importerName,
          supplierName: parsed.data.supplierName ?? null,
          countryOfExportCode: parsed.data.countryOfExportCode ?? null,
          countryOfOriginCode: parsed.data.countryOfOriginCode ?? null,
          shipmentReference: parsed.data.shipmentReference ?? null,
          importProcedureCode: parsed.data.importProcedureCode ?? null,
          incoterm: parsed.data.incoterm ?? null,
          assignedAgentId: parsed.data.assignedAgentId ?? null,
          clientUserId: parsed.data.clientUserId,
          trackingStatus: "received",
          trackingUpdatedAt: new Date(),
          trackingUpdatedByUserId: user.id,
          createdByUserId: user.id,
          notes: parsed.data.notes ?? null,
        })
        .returning();
      break;
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
      if (code === "23505" && attempt < 4) continue;
      throw error;
    }
  }

  if (!created) {
    return NextResponse.json(
      { error: "Failed to create import case" },
      { status: 500 },
    );
  }

  await recordInitialTrackingEvent({
    tenantId,
    importCaseId: created.id,
    actorUserId: user.id,
    clientUserId: created.clientUserId,
    caseNumber: created.caseNumber,
  });

  await writeAuditLog({
    tenantId,
    importCaseId: created.id,
    userId: user.id,
    entityType: "import_case",
    entityId: created.id,
    action: "import_case_created",
    newData: {
      caseNumber: created.caseNumber,
      status: created.status,
      clientUserId: created.clientUserId,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
