export const WIZARD_STEPS = [
  {
    id: "case-info",
    label: "Case info",
    shortLabel: "Case",
    description: "Importer, supplier, and shipment details",
    phase: 1,
  },
  {
    id: "documents",
    label: "Documents",
    shortLabel: "Docs",
    description: "Upload commercial invoice and packing list",
    phase: 1,
  },
  {
    id: "invoice-lines",
    label: "Invoice lines",
    shortLabel: "Invoice",
    description: "Review extracted invoice product lines",
    phase: 1,
  },
  {
    id: "packing-lines",
    label: "Packing list lines",
    shortLabel: "Packing",
    description: "Review extracted packing list lines",
    phase: 1,
  },
  {
    id: "checks",
    label: "Checks",
    shortLabel: "Checks",
    description: "Resolve warnings and errors",
    phase: 2,
  },
  {
    id: "products",
    label: "Harmonized products",
    shortLabel: "Products",
    description: "Match invoice and packing list into final products",
    phase: 3,
  },
  {
    id: "classification",
    label: "HS classification",
    shortLabel: "HS codes",
    description: "Review suggested HS codes — human approval required",
    phase: 4,
  },
  {
    id: "grouping-export",
    label: "Grouping & export",
    shortLabel: "Export",
    description: "Declaration grouping and export report",
    phase: 5,
  },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

export const ACTIVE_WIZARD_STEPS = WIZARD_STEPS;
export const LOCKED_WIZARD_STEPS: (typeof WIZARD_STEPS)[number][] = [];

export function isWizardStepId(value: string): value is WizardStepId {
  return WIZARD_STEPS.some((s) => s.id === value);
}

export function getWizardStepIndex(stepId: WizardStepId): number {
  return WIZARD_STEPS.findIndex((s) => s.id === stepId);
}

export function isStepUnlocked(stepId: WizardStepId): boolean {
  return WIZARD_STEPS.some((s) => s.id === stepId);
}
