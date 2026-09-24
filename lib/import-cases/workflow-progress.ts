import type { ImportCaseDocumentRow } from "@/db/schema/importCaseDocuments";
import type { ProductClassificationBundle } from "./classification-queries";
import type { GroupingWithProducts } from "./grouping-queries";
import type { CaseProductWithSources } from "./product-queries";
import {
  getWizardStepIndex,
  WIZARD_STEPS,
  type WizardStepId,
} from "./wizard-steps";

type InvoiceLine = { line: { id: string; isReviewed: boolean } };
type PackingLine = { line: { id: string; isReviewed: boolean } };

export type WizardCompletionContext = {
  documents: ImportCaseDocumentRow[];
  invoiceLines: InvoiceLine[];
  packingLines: PackingLine[];
  products: CaseProductWithSources[];
  classifications: ProductClassificationBundle[];
  groupings: GroupingWithProducts[];
};

function allInvoiceLinesReviewed(lines: InvoiceLine[]): boolean {
  return lines.length > 0 && lines.every((row) => row.line.isReviewed);
}

function allPackingLinesReviewed(lines: PackingLine[]): boolean {
  return lines.length > 0 && lines.every((row) => row.line.isReviewed);
}

export function isWizardStepComplete(
  stepId: WizardStepId,
  ctx: WizardCompletionContext,
): boolean {
  const hasInvoice = ctx.documents.some(
    (d) =>
      d.documentType === "commercial_invoice" &&
      d.extractionStatus === "completed",
  );
  const hasPacking = ctx.documents.some(
    (d) =>
      d.documentType === "packing_list" &&
      d.extractionStatus === "completed",
  );

  switch (stepId) {
    case "case-info":
      return true;
    case "documents":
      return hasInvoice && hasPacking;
    case "invoice-lines":
      return allInvoiceLinesReviewed(ctx.invoiceLines);
    case "packing-lines":
      return allPackingLinesReviewed(ctx.packingLines);
    case "checks":
      return (
        hasInvoice &&
        hasPacking &&
        allInvoiceLinesReviewed(ctx.invoiceLines) &&
        allPackingLinesReviewed(ctx.packingLines)
      );
    case "products":
      return (
        ctx.products.length > 0 &&
        ctx.products.every((p) => p.product.humanVerified)
      );
    case "classification": {
      const verified = ctx.classifications.filter(
        (c) => c.product.humanVerified,
      );
      return (
        verified.length > 0 &&
        verified.every((c) => c.classification?.isFinal)
      );
    }
    case "grouping-export":
      return ctx.groupings.length > 0;
    case "case-history":
      // Available once grouping is done; always "complete" when reachable
      // so progress can land here after export.
      return ctx.groupings.length > 0;
    default:
      return false;
  }
}

/**
 * A step is unlocked when every prior step is complete.
 * The first incomplete step is always reachable; later ones stay locked.
 */
export function isWizardStepUnlocked(
  stepId: WizardStepId,
  ctx: WizardCompletionContext,
): boolean {
  const index = getWizardStepIndex(stepId);
  if (index < 0) return false;
  for (let i = 0; i < index; i++) {
    if (!isWizardStepComplete(WIZARD_STEPS[i].id, ctx)) {
      return false;
    }
  }
  return true;
}

export function getWorkflowProgressPercent(
  ctx: WizardCompletionContext,
): number {
  const completed = WIZARD_STEPS.filter((step) =>
    isWizardStepComplete(step.id, ctx),
  ).length;
  return Math.round((completed / WIZARD_STEPS.length) * 100);
}

/**
 * First incomplete unlocked step — used when opening a case with no ?step=.
 * If every step is complete, returns the last step (case-history).
 */
export function getCurrentWizardStep(
  ctx: WizardCompletionContext,
): WizardStepId {
  for (const step of WIZARD_STEPS) {
    if (!isWizardStepComplete(step.id, ctx)) {
      return step.id;
    }
  }
  return WIZARD_STEPS[WIZARD_STEPS.length - 1].id;
}
