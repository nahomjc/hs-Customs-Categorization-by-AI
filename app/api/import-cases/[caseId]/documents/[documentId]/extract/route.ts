import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/import-cases/api-helpers";
import { processImportDocument } from "@/lib/import-cases/process-import-document";
import {
  getCaseDocument,
  getImportCaseById,
  getTenantId,
} from "@/lib/import-cases/queries";

type RouteParams = {
  params: Promise<{ caseId: string; documentId: string }>;
};

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId, documentId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  const document = await getCaseDocument(caseId, documentId);
  if (!document) return notFoundResponse("Document not found");

  const extraction = await processImportDocument(
    caseId,
    documentId,
    tenantId,
    user.id,
  );

  return NextResponse.json({ extraction });
}
