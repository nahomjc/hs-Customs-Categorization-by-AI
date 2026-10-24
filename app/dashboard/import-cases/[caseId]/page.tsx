import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import {
  ImportCaseBentoHeader,
  type CaseInvoiceValue,
} from "@/components/dashboard/import-case/ImportCaseBentoHeader";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { isClientRole, isStaffRole } from "@/lib/auth/roles";
import { getCaseAuditLogs } from "@/lib/import-cases/audit-queries";
import { getCaseClassifications } from "@/lib/import-cases/classification-queries";
import {
  getCaseGroupings,
  getUnclassifiedProducts,
} from "@/lib/import-cases/grouping-queries";
import type { UnclassifiedProduct } from "@/lib/import-cases/unclassified";
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
import { getCaseChecks, runImportCaseChecks } from "@/lib/import-cases/run-case-checks";
import {
  getWorkflowProgressPercent,
  isWizardStepComplete,
} from "@/lib/import-cases/workflow-progress";
import { WIZARD_STEPS } from "@/lib/import-cases/wizard-steps";
import { ImportCaseWizard } from "./ImportCaseWizard";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ caseId: string }>;
};

export default async function ImportCaseDetailPage({ params }: PageProps) {
  const { caseId } = await params;
  const tenantId = getTenantId();
  const session = await getSessionUserProfile();
  const role = session?.profile?.role ?? "user";

  if (isClientRole(role)) {
    redirect(`/dashboard/my-shipments/${caseId}`);
  }
  if (!isStaffRole(role)) {
    notFound();
  }

  let importCase: Awaited<ReturnType<typeof getImportCaseById>> | undefined;
  let documents: Awaited<ReturnType<typeof getCaseDocuments>> = [];
  let invoiceLines: Awaited<ReturnType<typeof getInvoiceLines>> = [];
  let packingLines: Awaited<ReturnType<typeof getPackingListLines>> = [];
  let checks: Awaited<ReturnType<typeof getCaseChecks>> = [];
  let products: Awaited<ReturnType<typeof getCaseProducts>> = [];
  let classifications: Awaited<ReturnType<typeof getCaseClassifications>> = [];
  let groupings: Awaited<ReturnType<typeof getCaseGroupings>> = [];
  let unclassified: UnclassifiedProduct[] = [];
  let referencePopulated = false;
  let agents: Awaited<ReturnType<typeof listTenantUsers>> = [];
  let auditLogs: Awaited<ReturnType<typeof getCaseAuditLogs>> = [];
  let client: {
    id: string;
    fullName: string | null;
    email: string;
    phone: string | null;
  } | null = null;

  try {
    const caseRow = await getImportCaseById(caseId, tenantId);
    if (!caseRow) notFound();
    importCase = caseRow;

    // Refresh open auto-checks from current lines before reading them.
    await runImportCaseChecks(caseId);

    [
      documents,
      invoiceLines,
      packingLines,
      checks,
      products,
      classifications,
      groupings,
      unclassified,
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
      getUnclassifiedProducts(caseId),
      isHsReferenceAvailable(),
      listTenantUsers(tenantId),
      getCaseAuditLogs(caseId, tenantId),
    ]);

    if (caseRow.clientUserId) {
      const [clientRow] = await db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
        })
        .from(users)
        .where(eq(users.id, caseRow.clientUserId))
        .limit(1);
      client = clientRow ?? null;
    }
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

  const completedSteps = WIZARD_STEPS.filter((step) =>
    isWizardStepComplete(step.id, progressCtx),
  ).length;

  // Invoice value: the amount declared on the case, else the sum of priced
  // invoice lines when they share one currency. Omitted when neither exists.
  let invoiceValue: CaseInvoiceValue | null = null;
  const declaredTotal = Number(importCase.invoiceTotalAmount);
  if (importCase.invoiceTotalAmount && Number.isFinite(declaredTotal) && declaredTotal > 0) {
    invoiceValue = {
      amount: declaredTotal,
      currency: importCase.invoiceCurrencyCode,
      source: "case",
    };
  } else {
    const currencies = new Set<string>();
    let linesTotal = 0;
    for (const { line } of invoiceLines) {
      if (line.unitPrice === null) continue;
      const qty = Number(line.quantity);
      const price = Number(line.unitPrice);
      if (!Number.isFinite(qty) || !Number.isFinite(price)) continue;
      linesTotal += qty * price;
      currencies.add(line.currencyCode);
    }
    if (linesTotal > 0 && currencies.size === 1) {
      invoiceValue = {
        amount: linesTotal,
        currency: [...currencies][0] ?? null,
        source: "lines",
      };
    }
  }

  return (
    <div className="space-y-4">
      <ImportCaseBentoHeader
        importCase={importCase}
        stats={stats}
        progressPercent={getWorkflowProgressPercent(progressCtx)}
        completedSteps={completedSteps}
        totalSteps={WIZARD_STEPS.length}
        invoiceLineCount={invoiceLines.length}
        packingLineCount={packingLines.length}
        invoiceValue={invoiceValue}
        clientLabel={
          client
            ? client.fullName ?? client.email
            : null
        }
      />

      <Suspense
        fallback={
          <div className="rounded-2xl border border-slate-200/70 bg-white p-10 text-center text-sm text-slate-500">
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
          unclassified={unclassified}
          referencePopulated={referencePopulated}
          agents={agents.map((agent) => ({
            id: agent.id,
            fullName: agent.fullName,
            email: agent.email,
          }))}
          client={client}
          auditLogs={auditLogs}
        />
      </Suspense>
    </div>
  );
}
