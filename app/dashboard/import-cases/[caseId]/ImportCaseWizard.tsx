"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { AuditLogTable } from "@/components/dashboard/AuditLogTable";
import { DashButton, DashCard } from "@/components/dashboard/ui";
import type { AuditLogView } from "@/lib/import-cases/audit-queries";
import type { DocumentCheckRow } from "@/db/schema/documentChecks";
import type { ImportCaseRow } from "@/db/schema/importCases";
import type { ImportCaseDocumentRow } from "@/db/schema/importCaseDocuments";
import type { ProductClassificationBundle } from "@/lib/import-cases/classification-queries";
import type { GroupingWithProducts } from "@/lib/import-cases/grouping-queries";
import type { CaseProductWithSources } from "@/lib/import-cases/product-queries";
import { isWizardStepComplete } from "@/lib/import-cases/workflow-progress";
import {
  ACTIVE_WIZARD_STEPS,
  getWizardStepIndex,
  isStepUnlocked,
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
  auditLogs,
}: ImportCaseWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");
  const initialStep: WizardStepId =
    stepParam && isWizardStepId(stepParam) && isStepUnlocked(stepParam)
      ? stepParam
      : "case-info";

  const [currentStep, setCurrentStep] = useState<WizardStepId>(initialStep);
  const [visitedSteps, setVisitedSteps] = useState<Set<WizardStepId>>(
    () => new Set([initialStep]),
  );

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

  const goToStep = useCallback(
    (stepId: WizardStepId) => {
      if (!isStepUnlocked(stepId)) return;
      setCurrentStep(stepId);
      setVisitedSteps((prev) => new Set(prev).add(stepId));
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", stepId);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  function goNext() {
    const idx = activeSteps.findIndex((s) => s.id === currentStep);
    if (idx >= 0 && idx < activeSteps.length - 1) {
      goToStep(activeSteps[idx + 1].id);
    }
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
    if (!isStepUnlocked(stepId)) return "locked";
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

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-6 items-start">
      {/* Sidebar navigation — right on desktop */}
      <aside className="hidden lg:block lg:order-2 sticky top-[4.5rem] z-10">
        <DashCard className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 bg-gradient-to-r from-slate-50 to-white">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Workflow
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              {completedCount} of {WIZARD_STEPS.length} steps complete
            </p>
            <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                style={{
                  width: `${(completedCount / WIZARD_STEPS.length) * 100}%`,
                }}
              />
            </div>
          </div>

          <nav className="p-2" aria-label="Workflow steps">
            {WIZARD_STEPS.map((step, index) => {
              const status = stepStatus(step.id, index);
              const unlocked = isStepUnlocked(step.id);
              const badge = stepBadge(step.id);

              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => unlocked && goToStep(step.id)}
                  className={`w-full flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-all mb-0.5 ${
                    status === "current"
                      ? "bg-indigo-50 shadow-sm ring-1 ring-indigo-100"
                      : unlocked
                        ? "hover:bg-slate-50"
                        : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <StepIcon status={status} index={index} stepId={step.id} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold leading-tight ${
                        status === "current"
                          ? "text-indigo-900"
                          : status === "complete"
                            ? "text-emerald-800"
                            : "text-slate-700"
                      }`}
                    >
                      {step.label}
                    </p>
                    {badge ? (
                      <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                        {badge}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-1">
                        {step.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </DashCard>
      </aside>

      {/* Main content */}
      <div className="min-w-0 space-y-5 lg:order-1">
        {/* Mobile progress */}
        <div className="lg:hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-semibold text-slate-800">
              Step {currentIndex + 1}: {currentMeta?.label}
            </p>
            <span className="text-xs font-medium text-indigo-600 tabular-nums">
              {completedCount}/{WIZARD_STEPS.length}
            </span>
          </div>
          <div className="flex gap-1">
            {WIZARD_STEPS.map((step, index) => {
              const status = stepStatus(step.id, index);
              const unlocked = isStepUnlocked(step.id);
              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => unlocked && goToStep(step.id)}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    status === "current"
                      ? "bg-indigo-600"
                      : status === "complete"
                        ? "bg-emerald-400"
                        : status === "locked"
                          ? "bg-slate-100"
                          : "bg-slate-200"
                  }`}
                  aria-label={step.label}
                />
              );
            })}
          </div>
        </div>

        {/* Step header */}
        <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-5 sm:px-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
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
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">
                Phase {currentMeta?.phase} · Step {currentIndex + 1}
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {currentMeta?.label}
              </h2>
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                {currentMeta?.description}
              </p>
            </div>
          </div>
        </div>

        {!isStepUnlocked(currentStep) ? (
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
                  <OverviewTab importCase={importCase} agents={agents} />
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
                  <>
                    <GroupingExportTab
                      caseId={importCase.id}
                      caseNumber={importCase.caseNumber}
                      initialGroupings={groupings}
                    />
                    <AuditLogTable
                      entries={auditLogs}
                      description="Who uploaded documents, ran extraction, classification, grouping, and other workflow steps on this case."
                    />
                  </>
                ) : null}
            </div>
          </>
        )}

        {isStepUnlocked(currentStep) ? (
          <div className="sticky bottom-4 z-20 dashboard-sticky-actions flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-md px-4 py-3 shadow-lg shadow-slate-200/50">
            <DashButton variant="secondary" onClick={goBack} disabled={isFirst}>
              ← Back
            </DashButton>
            <div className="flex items-center gap-3">
              {!isLastActive ? (
                <DashButton variant="primary" onClick={goNext}>
                  Continue →
                </DashButton>
              ) : (
                <p className="text-sm text-emerald-700 font-medium px-2">
                  Workflow complete — export your declaration CSV above.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StepIcon({
  status,
  index,
  stepId,
}: {
  status: StepStatus;
  index: number;
  stepId: WizardStepId;
}) {
  const base =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-all";

  if (status === "complete") {
    return (
      <span className={`${base} bg-emerald-100 text-emerald-700`}>
        <CheckIcon className="h-4 w-4" />
      </span>
    );
  }

  if (status === "locked") {
    return (
      <span className={`${base} bg-slate-100 text-slate-300`}>
        <LockIcon className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (status === "current") {
    return (
      <span
        className={`${base} bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm`}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <title>Step icon</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={STEP_ICONS[stepId]}
          />
        </svg>
      </span>
    );
  }

  return (
    <span className={`${base} bg-slate-100 text-slate-500`}>{index + 1}</span>
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
        : "Declaration groups ready. Download the CSV export for customs review.",
  };

  const hint = hints[stepId];
  if (!hint) return null;

  const hasInvoice = documents.some(
    (d) => d.documentType === "commercial_invoice",
  );
  const hasPacking = documents.some((d) => d.documentType === "packing_list");

  const isWarning =
    (stepId === "documents" && (!hasInvoice || !hasPacking)) ||
    (stepId === "invoice-lines" && unreviewedInvoiceCount > 0) ||
    (stepId === "packing-lines" && unreviewedPackingCount > 0) ||
    (stepId === "checks" && openCheckCount > 0);
  const isSuccess =
    !isWarning &&
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
              : false);

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
        <p className="mt-2 text-sm max-w-md mx-auto">{step?.description}</p>
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
