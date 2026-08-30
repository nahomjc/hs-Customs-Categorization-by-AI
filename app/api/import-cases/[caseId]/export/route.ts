import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/import-cases/api-helpers";
import { generateDeclarationCsv } from "@/lib/import-cases/export-declaration";
import { getCaseGroupings } from "@/lib/import-cases/grouping-queries";
import { loadHsReferenceCache } from "@/lib/hsReference";
import { getImportCaseById, getTenantId, writeAuditLog } from "@/lib/import-cases/queries";

type RouteParams = { params: Promise<{ caseId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  const groupings = await getCaseGroupings(caseId);
  if (groupings.length === 0) {
    return NextResponse.json(
      { error: "No declaration groups — run grouping first" },
      { status: 400 },
    );
  }

  await loadHsReferenceCache();

  const buffer = generateDeclarationCsv(importCase.caseNumber, groupings);
  const filename = `${importCase.caseNumber}-declaration.csv`;

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId: user.id,
    entityType: "import_case",
    entityId: caseId,
    action: "export_generated",
    newData: { format: "csv", groupCount: groupings.length },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
