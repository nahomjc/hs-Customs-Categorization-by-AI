import { getCaseClassifications } from "@/lib/import-cases/classification-queries";
import { getCaseGroupings } from "@/lib/import-cases/grouping-queries";
import { getCaseProducts } from "@/lib/import-cases/product-queries";
import {
  getCaseDocuments,
  getImportCaseById,
  getInvoiceLines,
  getPackingListLines,
  getTenantId,
} from "@/lib/import-cases/queries";
import { getCaseChecks } from "@/lib/import-cases/run-case-checks";
import {
  getCurrentWizardStep,
  getWizardStepWarnings,
  getWorkflowProgressPercent,
  isWizardStepComplete,
  isWizardStepUnlocked,
  type WizardCompletionContext,
} from "@/lib/import-cases/workflow-progress";
import {
  isWizardStepId,
  WIZARD_STEPS,
  type WizardStepId,
} from "@/lib/import-cases/wizard-steps";

const IMPORT_CASE_PATH =
  /^\/dashboard\/import-cases\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export function parseImportCaseIdFromPath(pathname: string): string | null {
  const m = pathname.match(IMPORT_CASE_PATH);
  return m?.[1] ?? null;
}

export async function buildImportCaseAssistantContext(
  caseId: string,
  viewedStepId?: string | null,
): Promise<string | null> {
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return null;

  const [
    documents,
    invoiceLines,
    packingLines,
    checks,
    products,
    classifications,
    groupings,
  ] = await Promise.all([
    getCaseDocuments(caseId),
    getInvoiceLines(caseId),
    getPackingListLines(caseId),
    getCaseChecks(caseId),
    getCaseProducts(caseId),
    getCaseClassifications(caseId),
    getCaseGroupings(caseId),
  ]);

  const ctx: WizardCompletionContext = {
    documents,
    invoiceLines,
    packingLines,
    products,
    classifications,
    groupings,
  };

  const openCheckCount = checks.filter((c) => c.status === "open").length;
  const progressPercent = getWorkflowProgressPercent(ctx);
  const suggestedStep = getCurrentWizardStep(ctx);
  const viewedStep: WizardStepId =
    viewedStepId && isWizardStepId(viewedStepId) ? viewedStepId : suggestedStep;
  const viewedMeta = WIZARD_STEPS.find((s) => s.id === viewedStep);
  const viewedWarnings = getWizardStepWarnings(
    viewedStep,
    ctx,
    openCheckCount,
  );

  const stepLines = WIZARD_STEPS.map((step) => {
    const complete = isWizardStepComplete(step.id, ctx);
    const unlocked = isWizardStepUnlocked(step.id, ctx);
    const status = complete ? "complete" : unlocked ? "in progress / available" : "locked";
    const marker =
      step.id === viewedStep ? " ← user is viewing this tab" : "";
    return `- ${step.label} (${step.id}): ${status}. ${step.description}${marker}`;
  }).join("\n");

  const docSummary = documents.length
    ? documents
        .map(
          (d) =>
            `  - ${d.originalFileName ?? d.id}: type=${d.documentType ?? "?"}, extraction=${d.extractionStatus ?? "?"}`,
        )
        .join("\n")
    : "  (none)";

  return `IMPORT CASE CONTEXT (use this to answer questions about "this case", "this step", or what to do next):

Case: ${importCase.caseNumber ?? caseId}
Status: ${importCase.status ?? "unknown"}
Importer: ${importCase.importerName ?? "—"}
Supplier: ${importCase.supplierName ?? "—"}
Shipment ref: ${importCase.shipmentReference ?? "—"}
Workflow progress: ${progressPercent}% complete
Suggested next workflow step (first incomplete): ${suggestedStep}
User's open wizard tab (?step=): ${viewedStep} — ${viewedMeta?.label ?? viewedStep}
Tab purpose: ${viewedMeta?.description ?? "—"}
${
  viewedWarnings.length > 0
    ? `Blockers / warnings on the tab they are viewing:\n${viewedWarnings.map((w) => `  - ${w}`).join("\n")}`
    : "The tab they are viewing has no listed blockers — they may be ready to continue."
}

Counts: ${documents.length} document(s), ${invoiceLines.length} invoice line(s), ${packingLines.length} packing line(s), ${products.length} harmonized product(s), ${groupings.length} export group(s), ${openCheckCount} open check(s).

Documents:
${docSummary}

Wizard steps (Impact Logistics import-case workflow):
${stepLines}

When the user asks about their current step, explain what that step is for, what is done vs pending on THIS case, and the concrete next action in the app (buttons/tabs: Documents, Harmonize, Classify, Grouping & export, etc.). Do not invent HS codes or line items not reflected above.`;
}
