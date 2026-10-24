"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CaseHistoryPanel } from "@/components/dashboard/import-case/CaseHistoryPanel";
import {
  BentoCard,
  PromoBanner,
  promoButtonClass,
} from "@/components/dashboard/bento/BentoCard";
import { BentoIcon } from "@/components/dashboard/bento/icons";
import {
  CaseActivityCard,
  CaseDetailsCard,
  CaseDocumentsCard,
} from "@/components/dashboard/import-case/CaseSideCards";
import {
  CaseWorkflowStepper,
  type StepperStep,
} from "@/components/dashboard/import-case/CaseWorkflowStepper";
import { DashButton, DashCard } from "@/components/dashboard/ui";
import type { AuditLogView } from "@/lib/import-cases/audit-queries";
import type { DocumentCheckRow } from "@/db/schema/documentChecks";
import type { ImportCaseRow } from "@/db/schema/importCases";
import type { ImportCaseDocumentRow } from "@/db/schema/importCaseDocuments";
import type { ProductClassificationBundle } from "@/lib/import-cases/classification-queries";
import type { GroupingWithProducts } from "@/lib/import-cases/grouping-queries";
import type { CaseProductWithSources } from "@/lib/import-cases/product-queries";
import {
  getCurrentWizardStep,
  getWizardStepWarnings,
  isWizardStepComplete,
  isWizardStepUnlocked,
} from "@/lib/import-cases/workflow-progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ACTIVE_WIZARD_STEPS,
  getWizardStepIndex,
  isWizardStepId,
  WIZARD_STEPS,
  type WizardStepId,
} from "@/lib/import-cases/wizard-steps";
import { ClassificationTab } from "./tabs/ClassificationTab";
import { ChecksTab } from "./tabs/ChecksTab";
import { DocumentsTab } from "./tabs/DocumentsTab";
import { InvoiceLinesTab } from "./tabs/InvoiceLinesTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { PackingListLinesTab } from "./tabs/PackingListLinesTab";
import { GroupingExportTab } from "./tabs/GroupingExportTab";
import { ProductsTab } from "./tabs/ProductsTab";

type InvoiceLineWithDoc = {
  line: {
    id: string;
    lineNumber: number;
    supplierDescription: string;
    quantity: string;
    unitOfMeasure: string;
    unitPrice: string | null;
    currencyCode: string;
    isReviewed: boolean;
  };
  documentName: string | null;
  documentType: string | null;
};

type PackingLineWithDoc = {
  line: {
    id: string;
    lineNumber: number;
    supplierDescription: string;
    quantity: string;
    unitOfMeasure: string;
    numberOfPackages: string | null;
    packageType: string | null;
    netWeightKg: string | null;
    grossWeightKg: string | null;
    isReviewed: boolean;
  };
  documentName: string | null;
  documentType: string | null;
};

type AgentOption = {
  id: string;
  fullName: string | null;
  email: string;
};

type ClientOption = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
};

type ImportCaseWizardProps = {
  importCase: ImportCaseRow;
  documents: ImportCaseDocumentRow[];
  invoiceLines: InvoiceLineWithDoc[];
  packingLines: PackingLineWithDoc[];
  checks: DocumentCheckRow[];
  products: CaseProductWithSources[];
  classifications: ProductClassificationBundle[];
  groupings: GroupingWithProducts[];
  referencePopulated: boolean;
  agents: AgentOption[];
  client?: ClientOption | null;
  auditLogs: AuditLogView[];
};

type StepStatus = "complete" | "current" | "upcoming" | "locked";

const STEP_ICONS: Record<WizardStepId, string> = {
  "case-info": "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  documents:
    "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  "invoice-lines":
    "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  "packing-lines":
    "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  checks:
    "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  products:
    "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  classification:
    "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  "grouping-export":
    "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  "case-history":
    "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
};

export function ImportCaseWizard({
  importCase,
  documents,
  invoiceLines,
  packingLines,
  checks,
  products,
  classifications,
  groupings,
  referencePopulated,
  agents,
  client = null,
  auditLogs,
}: ImportCaseWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");

  const completionCtx = useMemo(
    () => ({
      documents,
      invoiceLines,
      packingLines,
      products,
      classifications,
      groupings,
    }),
    [documents, invoiceLines, packingLines, products, classifications, groupings],
  );

  const progressStep = useMemo(
    () => getCurrentWizardStep(completionCtx),
    [completionCtx],
  );

  const stepUnlocked = useCallback(
    (stepId: WizardStepId) => isWizardStepUnlocked(stepId, completionCtx),
    [completionCtx],
  );

  const resolvedStep: WizardStepId =
    stepParam && isWizardStepId(stepParam) && stepUnlocked(stepParam)
      ? stepParam
      : progressStep;

  const [currentStep, setCurrentStep] = useState<WizardStepId>(resolvedStep);
  const [visitedSteps, setVisitedSteps] = useState<Set<WizardStepId>>(
    () => new Set([resolvedStep]),
  );
  const [continueWarningOpen, setContinueWarningOpen] = useState(false);
  const [continueWarnings, setContinueWarnings] = useState<string[]>([]);

  // Open on the furthest incomplete step when URL has no valid ?step=
  useEffect(() => {
    if (stepParam && isWizardStepId(stepParam) && stepUnlocked(stepParam)) {
      setCurrentStep(stepParam);
      setVisitedSteps((prev) => new Set(prev).add(stepParam));
      return;
    }
    setCurrentStep(progressStep);
    setVisitedSteps((prev) => new Set(prev).add(progressStep));
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("step") !== progressStep) {
      params.set("step", progressStep);
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [stepParam, progressStep, router, searchParams, stepUnlocked]);

  const currentIndex = getWizardStepIndex(currentStep);
  const activeSteps = ACTIVE_WIZARD_STEPS;
  const openCheckCount = checks.filter((c) => c.status === "open").length;

  const invoiceDocuments = documents.filter(
    (d) =>
      d.documentType === "commercial_invoice" ||
      d.documentType === "proforma_invoice",
  );
  const packingDocuments = documents.filter(
    (d) => d.documentType === "packing_list",
  );

  const verifiedProductCount = products.filter(
    (p) => p.product.humanVerified,
  ).length;

  const approvedClassificationCount = classifications.filter(
    (c) => c.product.humanVerified && c.classification?.isFinal,
  ).length;

  const goToStep = useCallback(
    (stepId: WizardStepId, options?: { bypassUnlock?: boolean }) => {
      if (!options?.bypassUnlock && !stepUnlocked(stepId)) return;
      setCurrentStep(stepId);
      setVisitedSteps((prev) => new Set(prev).add(stepId));
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", stepId);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, stepUnlocked],
  );

  function advanceToNextStep() {
    const idx = activeSteps.findIndex((s) => s.id === currentStep);
    if (idx >= 0 && idx < activeSteps.length - 1) {
      goToStep(activeSteps[idx + 1].id, { bypassUnlock: true });
    }
    setContinueWarningOpen(false);
    setContinueWarnings([]);
  }

  function goNext() {
    const idx = activeSteps.findIndex((s) => s.id === currentStep);
    if (idx < 0 || idx >= activeSteps.length - 1) return;

    const warnings = getWizardStepWarnings(
      currentStep,
      completionCtx,
      openCheckCount,
    );
    if (warnings.length > 0) {
      setContinueWarnings(warnings);
      setContinueWarningOpen(true);
      return;
    }
    advanceToNextStep();
  }

  function goBack() {
    const idx = activeSteps.findIndex((s) => s.id === currentStep);
    if (idx > 0) {
      goToStep(activeSteps[idx - 1].id);
    }
  }

  const currentMeta = WIZARD_STEPS.find((s) => s.id === currentStep);
  const isFirst = currentStep === activeSteps[0].id;
  const isLastActive = currentStep === activeSteps[activeSteps.length - 1].id;
  const completedCount = WIZARD_STEPS.filter((s) =>
    isWizardStepComplete(s.id, completionCtx),
  ).length;

  function stepStatus(stepId: WizardStepId, index: number): StepStatus {
    if (!stepUnlocked(stepId)) return "locked";
    if (stepId === currentStep) return "current";
    if (isWizardStepComplete(stepId, completionCtx)) return "complete";
    if (visitedSteps.has(stepId) || index < currentIndex) return "upcoming";
    return "upcoming";
  }

  function stepBadge(stepId: WizardStepId): string | null {
    if (stepId === "documents") {
      const count = documents.length;
      return count > 0 ? `${count} file(s)` : null;
    }
    if (stepId === "invoice-lines" && invoiceLines.length > 0) {
      const reviewed = invoiceLines.filter((l) => l.line.isReviewed).length;
      return `${reviewed}/${invoiceLines.length} reviewed`;
    }
    if (stepId === "packing-lines" && packingLines.length > 0) {
      const reviewed = packingLines.filter((l) => l.line.isReviewed).length;
      return `${reviewed}/${packingLines.length} reviewed`;
    }
    if (stepId === "checks" && openCheckCount > 0) {
      return `${openCheckCount} open`;
    }
    if (stepId === "products" && products.length > 0) {
      return `${verifiedProductCount}/${products.length} verified`;
    }
    if (stepId === "classification" && verifiedProductCount > 0) {
      return `${approvedClassificationCount}/${verifiedProductCount} approved`;
    }
    if (stepId === "grouping-export" && groupings.length > 0) {
      return `${groupings.length} group(s)`;
    }
    return null;
  }

  const stepperSteps: StepperStep[] = WIZARD_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    shortLabel: step.shortLabel,
    description: step.description,
    status: stepStatus(step.id, index),
    badge: stepBadge(step.id),
  }));
  const nextMeta = isLastActive ? null : (activeSteps[currentIndex + 1] ?? null);
  const showNextBanner = Boolean(nextMeta && !isLastActive);

  return (
    <div className="min-w-0 space-y-4">
      <CaseWorkflowStepper
        steps={stepperSteps}
        completedCount={completedCount}
        nextLabel={nextMeta?.label ?? null}
        onSelect={(id) => {
          if (isWizardStepId(id)) goToStep(id);
        }}
      />

      {showNextBanner && nextMeta ? (
        <PromoBanner
          title={`Next: ${nextMeta.label}`}
          description={
            isWizardStepComplete(currentStep, completionCtx)
              ? `${currentMeta?.label ?? "This step"} is done. ${nextMeta.description}.`
              : `${nextMeta.description}. Use Continue when you are ready to move on.`
          }
          action={
            <button type="button" onClick={goNext} className={promoButtonClass}>
              Continue
              <BentoIcon name="chevron" className="h-4 w-4" strokeWidth={2} />
            </button>
          }
        />
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          {/* Current step card */}
          <BentoCard padded={false} className="overflow-hidden" label="Current step">
            <div className="flex items-start gap-4 px-5 py-5 sm:px-6">
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#007bff] sm:flex">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <title>{currentMeta?.label}</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d={STEP_ICONS[currentStep]}
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#007bff]">
                    Phase {currentMeta?.phase} &middot; Step {currentIndex + 1} of{" "}
                    {WIZARD_STEPS.length}
                  </p>
                  <span className="text-xs font-medium tabular-nums text-slate-400">
                    {completedCount}/{WIZARD_STEPS.length} complete
                  </span>
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {currentMeta?.label}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  {currentMeta?.description}
                </p>
              </div>
            </div>
          </BentoCard>

          {!stepUnlocked(currentStep) ? (
            <LockedStepPanel stepId={currentStep} />
          ) : (
            <>
              <StepHint
                stepId={currentStep}
                documents={documents}
                invoiceLines={invoiceLines}
                packingLines={packingLines}
                openCheckCount={openCheckCount}
                products={products}
                classifications={classifications}
                groupings={groupings}
              />

              <div className="space-y-6">
                {currentStep === "case-info" ? (
                  <OverviewTab
                    importCase={importCase}
                    agents={agents}
                    client={client}
                  />
                ) : null}
                {currentStep === "documents" ? (
                  <DocumentsTab
                    caseId={importCase.id}
                    initialDocuments={documents}
                  />
                ) : null}
                {currentStep === "invoice-lines" ? (
                  <InvoiceLinesTab
                    caseId={importCase.id}
                    invoiceDocuments={invoiceDocuments}
                    initialLines={invoiceLines as never}
                  />
                ) : null}
                {currentStep === "packing-lines" ? (
                  <PackingListLinesTab
                    caseId={importCase.id}
                    packingDocuments={packingDocuments}
                    initialLines={packingLines as never}
                  />
                ) : null}
                {currentStep === "checks" ? (
                  <ChecksTab caseId={importCase.id} checks={checks} />
                ) : null}
                {currentStep === "products" ? (
                  <ProductsTab
                    caseId={importCase.id}
                    initialProducts={products}
                  />
                ) : null}
                {currentStep === "classification" ? (
                  <ClassificationTab
                    caseId={importCase.id}
                    initialClassifications={classifications}
                    referencePopulated={referencePopulated}
                  />
                ) : null}
                {currentStep === "grouping-export" ? (
                  <GroupingExportTab
                    caseId={importCase.id}
                    caseNumber={importCase.caseNumber}
                    initialGroupings={groupings}
                  />
                ) : null}
                {currentStep === "case-history" ? (
                  <CaseHistoryPanel
                    entries={auditLogs}
                    caseNumber={importCase.caseNumber}
                  />
                ) : null}
              </div>

          {/* End-of-step actions (scroll destination after finishing work) */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 sm:px-5">
            <DashButton
              variant="secondary"
              onClick={goBack}
              disabled={isFirst}
              className="min-w-26"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </DashButton>
            {!isLastActive ? (
              <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
                {nextMeta ? (
                  <span className="hidden text-xs text-slate-400 sm:inline">
                    Next: {nextMeta.label}
                  </span>
                ) : null}
                <DashButton
                  variant="primary"
                  onClick={goNext}
                  className="min-w-30"
                >
                  Continue
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </DashButton>
              </div>
            ) : (
              <p className="ml-auto px-2 text-sm font-medium text-emerald-700">
                Workflow complete - review case history above.
              </p>
            )}
          </div>
            </>
          )}
        </div>

        {/* Side cards */}
        <aside aria-label="Case sidebar" className="min-w-0 space-y-4">
          <CaseDetailsCard importCase={importCase} agents={agents} client={client} />
          <CaseDocumentsCard
            documents={documents}
            onManage={() => goToStep("documents")}
          />
          {currentStep !== "case-history" ? (
            <CaseActivityCard
              entries={auditLogs}
              onViewAll={
                stepUnlocked("case-history")
                  ? () => goToStep("case-history")
                  : undefined
              }
            />
          ) : null}
        </aside>
      </div>

      <Dialog open={continueWarningOpen} onOpenChange={setContinueWarningOpen}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left">
            <DialogTitle>Step not fully complete</DialogTitle>
            <DialogDescription>
              You can continue anyway, but the following items still need
              attention on this step:
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-60 overflow-y-auto px-5 py-4 text-sm text-slate-700 list-disc pl-8 space-y-2">
            {continueWarnings.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <DialogFooter className="flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
            <DashButton
              variant="secondary"
              type="button"
              onClick={() => setContinueWarningOpen(false)}
            >
              Stay on this step
            </DashButton>
            <DashButton type="button" onClick={advanceToNextStep}>
              Continue anyway
            </DashButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StepHint({
  stepId,
  documents,
  invoiceLines,
  packingLines,
  openCheckCount,
  products,
  classifications,
  groupings,
}: {
  stepId: WizardStepId;
  documents: ImportCaseDocumentRow[];
  invoiceLines: InvoiceLineWithDoc[];
  packingLines: PackingLineWithDoc[];
  openCheckCount: number;
  products: CaseProductWithSources[];
  classifications: ProductClassificationBundle[];
  groupings: GroupingWithProducts[];
}) {
  const unverifiedCount = products.filter(
    (p) => !p.product.humanVerified,
  ).length;
  const unapprovedCount = classifications.filter(
    (c) => !c.classification?.isFinal,
  ).length;
  const unreviewedInvoiceCount = invoiceLines.filter(
    (l) => !l.line.isReviewed,
  ).length;
  const unreviewedPackingCount = packingLines.filter(
    (l) => !l.line.isReviewed,
  ).length;

  const hints: Partial<Record<WizardStepId, string>> = {
    "case-info":
      "Confirm importer and supplier details. Continue when ready to upload documents.",
    documents:
      "Upload both a commercial invoice and a packing list. Lines are extracted automatically.",
    "invoice-lines":
      invoiceLines.length === 0
        ? "No invoice lines yet — go back to Documents and click Extract now, or add lines manually."
        : unreviewedInvoiceCount > 0
          ? `${unreviewedInvoiceCount} invoice line(s) still need review. Use Approve all or review each line before continuing.`
          : "All invoice lines reviewed. Continue to packing list lines.",
    "packing-lines":
      packingLines.length === 0
        ? "No packing list lines yet — go back to Documents and click Extract now, or add lines manually."
        : unreviewedPackingCount > 0
          ? `${unreviewedPackingCount} packing line(s) still need review. Use Approve all or review each line before continuing.`
          : "All packing list lines reviewed. Continue to validation checks.",
    checks:
      openCheckCount > 0
        ? `${openCheckCount} open check(s) need review. Resolve or note before harmonization.`
        : "No open checks. Continue to harmonized products.",
    products:
      products.length === 0
        ? "Run harmonization to match invoice and packing list lines into final products."
        : unverifiedCount > 0
          ? `${unverifiedCount} product(s) need human confirmation before HS classification.`
          : "All products verified. Continue to HS classification.",
    classification:
      classifications.length === 0
        ? "Run classification to generate HS code suggestions for each product."
        : unapprovedCount > 0
          ? `${unapprovedCount} product(s) need HS code approval before grouping.`
          : "All HS codes approved. Continue to declaration grouping.",
    "grouping-export":
      groupings.length === 0
        ? "Run grouping to combine products into declaration lines, then download the CSV export."
        : "Declaration groups ready. Download the CSV export, then continue to case history.",
    "case-history":
      "Review the full audit trail — who approved, corrected, or exported at each step.",
  };

  const hint = hints[stepId];
  if (!hint) return null;

  const hasInvoice = documents.some(
    (d) => d.documentType === "commercial_invoice",
  );
  const hasPacking = documents.some((d) => d.documentType === "packing_list");

  const isWarning =
    (stepId === "documents" && (!hasInvoice || !hasPacking)) ||
    (stepId === "invoice-lines" &&
      (invoiceLines.length === 0 || unreviewedInvoiceCount > 0)) ||
    (stepId === "packing-lines" &&
      (packingLines.length === 0 || unreviewedPackingCount > 0)) ||
    (stepId === "checks" && openCheckCount > 0) ||
    (stepId === "products" &&
      (products.length === 0 || unverifiedCount > 0)) ||
    (stepId === "classification" &&
      (classifications.length === 0 || unapprovedCount > 0)) ||
    (stepId === "grouping-export" && groupings.length === 0);
  const isSuccess =
    !isWarning &&
    (stepId === "case-history" ||
      (stepId === "invoice-lines"
        ? invoiceLines.length > 0 && unreviewedInvoiceCount === 0
        : stepId === "packing-lines"
          ? packingLines.length > 0 && unreviewedPackingCount === 0
          : stepId === "products"
            ? products.length > 0 && unverifiedCount === 0
            : stepId === "classification"
              ? classifications.length > 0 && unapprovedCount === 0
              : stepId === "grouping-export"
                ? groupings.length > 0
                : false));

  return (
    <div
      className={`flex gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-relaxed ${
        isWarning
          ? "border-amber-200/80 bg-amber-50 text-amber-900"
          : isSuccess
            ? "border-emerald-200/80 bg-emerald-50 text-emerald-900"
            : "border-indigo-100 bg-indigo-50/70 text-indigo-900"
      }`}
    >
      <span className="shrink-0 mt-0.5">
        {isWarning ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-200/60 text-amber-800 text-xs font-bold">
            !
          </span>
        ) : isSuccess ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-200/60 text-emerald-800">
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-200/60 text-indigo-700 text-xs font-bold">
            i
          </span>
        )}
      </span>
      <p>{hint}</p>
    </div>
  );
}

function LockedStepPanel({ stepId }: { stepId: WizardStepId }) {
  const step = WIZARD_STEPS.find((s) => s.id === stepId);
  return (
    <DashCard>
      <div className="p-10 text-center text-slate-500">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <LockIcon className="h-6 w-6 text-slate-400" />
        </div>
        <p className="font-semibold text-slate-800 text-lg">{step?.label}</p>
        <p className="mt-2 text-sm max-w-md mx-auto">
          This step is locked. Finish the previous steps first, then continue
          here.
        </p>
      </div>
    </DashCard>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <title>Complete</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function LockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <title>Locked</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}
