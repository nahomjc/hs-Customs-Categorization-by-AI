import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/import-cases/api-helpers";
import { generateDeclarationCsv } from "@/lib/import-cases/export-declaration";
import { buildSadDraft } from "@/lib/import-cases/export-sad";
import { generateSadExcel } from "@/lib/import-cases/export-sad-excel";
import { generateSadPdf } from "@/lib/import-cases/export-sad-pdf";
import {
  getCaseGroupings,
  getUnclassifiedProducts,
} from "@/lib/import-cases/grouping-queries";
import { loadCaseOriginData } from "@/lib/import-cases/origin-load";
import { loadHsReferenceCache } from "@/lib/hsReference";
import { getImportCaseById, getTenantId, writeAuditLog } from "@/lib/import-cases/queries";

type RouteParams = { params: Promise<{ caseId: string }> };

type ExportFormat = "csv" | "sad-pdf" | "sad-xlsx";

function parseFormat(raw: string | null): ExportFormat | null {
  if (!raw || raw === "csv") return "csv";
  if (raw === "sad-pdf" || raw === "sad-xlsx") return raw;
  return null;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId } = await params;
  const format = parseFormat(request.nextUrl.searchParams.get("format"));
  if (!format) {
    return NextResponse.json(
      { error: "Invalid format — use csv, sad-pdf, or sad-xlsx" },
      { status: 400 },
    );
  }

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

  const [unclassified, origins] = await Promise.all([
    getUnclassifiedProducts(caseId),
    loadCaseOriginData(caseId),
  ]);

  const extras = { unclassified, origins };

  let buffer: Buffer;
  let filename: string;
  let contentType: string;

  if (format === "csv") {
    buffer = generateDeclarationCsv(importCase.caseNumber, groupings, extras);
    filename = `${importCase.caseNumber}-declaration.csv`;
    contentType = "text/csv; charset=utf-8";
  } else {
    const draft = buildSadDraft(importCase, groupings, extras);
    if (format === "sad-pdf") {
      buffer = await generateSadPdf(draft);
      filename = `${importCase.caseNumber}-SAD-draft.pdf`;
      contentType = "application/pdf";
    } else {
      buffer = await generateSadExcel(draft);
      filename = `${importCase.caseNumber}-SAD-draft.xlsx`;
      contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
  }

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId: user.id,
    entityType: "import_case",
    entityId: caseId,
    action: "export_generated",
    newData: {
      format,
      groupCount: groupings.length,
      unclassifiedCount: unclassified.length,
    },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
