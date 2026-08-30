import type { DocumentCheckRow } from "@/db/schema/documentChecks";
import type { ImportCaseDocumentRow } from "@/db/schema/importCaseDocuments";
import type { ProductClassificationBundle } from "./classification-queries";
import type { GroupingWithProducts } from "./grouping-queries";
import type { CaseProductWithSources } from "./product-queries";
import { WIZARD_STEPS, type WizardStepId } from "./wizard-steps";

type InvoiceLine = { line: { id: string; isReviewed: boolean } };
type PackingLine = { line: { id: string; isReviewed: boolean } };

function allInvoiceLinesReviewed(lines: InvoiceLine[]): boolean {
  return lines.length > 0 && lines.every((row) => row.line.isReviewed);
}

function allPackingLinesReviewed(lines: PackingLine[]): boolean {
  return lines.length > 0 && lines.every((row) => row.line.isReviewed);
}

export function isWizardStepComplete(
  stepId: WizardStepId,
  ctx: {
    documents: ImportCaseDocumentRow[];
    invoiceLines: InvoiceLine[];
    packingLines: PackingLine[];
    products: CaseProductWithSources[];
    classifications: ProductClassificationBundle[];
    groupings: GroupingWithProducts[];
  },
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
    default:
      return false;
  }
}

export function getWorkflowProgressPercent(ctx: {
  documents: ImportCaseDocumentRow[];
  invoiceLines: InvoiceLine[];
  packingLines: PackingLine[];
  products: CaseProductWithSources[];
  classifications: ProductClassificationBundle[];
  groupings: GroupingWithProducts[];
}): number {
  const completed = WIZARD_STEPS.filter((step) =>
    isWizardStepComplete(step.id, ctx),
  ).length;
  return Math.round((completed / WIZARD_STEPS.length) * 100);
}
