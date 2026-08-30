import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ImportCaseHero } from "@/components/dashboard/import-case/ImportCaseHero";
import { getCaseAuditLogs } from "@/lib/import-cases/audit-queries";
import { getCaseClassifications } from "@/lib/import-cases/classification-queries";
import { getCaseGroupings } from "@/lib/import-cases/grouping-queries";
import { isHsReferenceAvailable } from "@/lib/import-cases/classify-product-description";
import { getCaseProducts } from "@/lib/import-cases/product-queries";
import {
  getCaseDocuments,
  getImportCaseById,
  getInvoiceLines,
  getPackingListLines,
  getTenantId,
  listTenantUsers,
} from "@/lib/import-cases/queries";
import { getCaseChecks } from "@/lib/import-cases/run-case-checks";
import { getWorkflowProgressPercent } from "@/lib/import-cases/workflow-progress";
import { ImportCaseWizard } from "./ImportCaseWizard";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ caseId: string }>;
};

export default async function ImportCaseDetailPage({ params }: PageProps) {
  const { caseId } = await params;
  const tenantId = getTenantId();

  let importCase: Awaited<ReturnType<typeof getImportCaseById>> | undefined;
  let documents: Awaited<ReturnType<typeof getCaseDocuments>> = [];
  let invoiceLines: Awaited<ReturnType<typeof getInvoiceLines>> = [];
  let packingLines: Awaited<ReturnType<typeof getPackingListLines>> = [];
  let checks: Awaited<ReturnType<typeof getCaseChecks>> = [];
  let products: Awaited<ReturnType<typeof getCaseProducts>> = [];
  let classifications: Awaited<ReturnType<typeof getCaseClassifications>> = [];
  let groupings: Awaited<ReturnType<typeof getCaseGroupings>> = [];
  let referencePopulated = false;
  let agents: Awaited<ReturnType<typeof listTenantUsers>> = [];
  let auditLogs: Awaited<ReturnType<typeof getCaseAuditLogs>> = [];

  try {
    const caseRow = await getImportCaseById(caseId, tenantId);
    if (!caseRow) notFound();
    importCase = caseRow;
    [
      documents,
      invoiceLines,
      packingLines,
      checks,
      products,
      classifications,
      groupings,
      referencePopulated,
      agents,
      auditLogs,
    ] = await Promise.all([
      getCaseDocuments(caseId),
      getInvoiceLines(caseId),
      getPackingListLines(caseId),
      getCaseChecks(caseId),
      getCaseProducts(caseId),
      getCaseClassifications(caseId),
      getCaseGroupings(caseId),
      isHsReferenceAvailable(),
      listTenantUsers(tenantId),
      getCaseAuditLogs(caseId, tenantId),
    ]);
  } catch {
    notFound();
  }

  const progressCtx = {
    documents,
    invoiceLines,
    packingLines,
    products,
    classifications,
    groupings,
  };

  const stats = {
    documents: documents.length,
    products: products.length,
    verifiedProducts: products.filter((p) => p.product.humanVerified).length,
    approvedClassifications: classifications.filter(
      (c) => c.classification?.isFinal,
    ).length,
    groupings: groupings.length,
    openChecks: checks.filter((c) => c.status === "open").length,
  };

  return (
    <div className="space-y-6">
      <ImportCaseHero
        importCase={importCase}
        stats={stats}
        progressPercent={getWorkflowProgressPercent(progressCtx)}
      />

      <Suspense
        fallback={
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Loading workflow…
          </div>
        }
      >
        <ImportCaseWizard
          importCase={importCase}
          documents={documents}
          invoiceLines={invoiceLines}
          packingLines={packingLines}
          checks={checks}
          products={products}
          classifications={classifications}
          groupings={groupings}
          referencePopulated={referencePopulated}
          agents={agents.map((agent) => ({
            id: agent.id,
            fullName: agent.fullName,
            email: agent.email,
          }))}
          auditLogs={auditLogs}
        />
      </Suspense>
    </div>
  );
}
