export const IMPORT_CASE_STATUSES = [
  "draft",
  "documents_uploaded",
  "extraction_in_progress",
  "needs_information",
  "ready_for_classification",
  "classification_in_review",
  "ready_for_declaration",
  "completed",
  "cancelled",
] as const;

export type ImportCaseStatus = (typeof IMPORT_CASE_STATUSES)[number];

export const DOCUMENT_TYPES = [
  "commercial_invoice",
  "packing_list",
  "proforma_invoice",
  "bill_of_lading",
  "airway_bill",
  "certificate_of_origin",
  "freight_invoice",
  "insurance_document",
  "product_catalogue",
  "product_specification",
  "product_photo",
  "payment_document",
  "permit",
  "other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = [
  "uploaded",
  "processing",
  "extracted",
  "needs_review",
  "approved",
  "rejected",
  "failed",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const EXTRACTION_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "reviewed",
] as const;

export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  commercial_invoice: "Commercial Invoice",
  packing_list: "Packing List",
  proforma_invoice: "Proforma Invoice",
  bill_of_lading: "Bill of Lading",
  airway_bill: "Airway Bill",
  certificate_of_origin: "Certificate of Origin",
  freight_invoice: "Freight Invoice",
  insurance_document: "Insurance Document",
  product_catalogue: "Product Catalogue",
  product_specification: "Product Specification",
  product_photo: "Product Photo",
  payment_document: "Payment Document",
  permit: "Permit",
  other: "Other",
};

export const IMPORT_CASE_STATUS_LABELS: Record<ImportCaseStatus, string> = {
  draft: "Draft",
  documents_uploaded: "Documents Uploaded",
  extraction_in_progress: "Extraction In Progress",
  needs_information: "Needs Information",
  ready_for_classification: "Ready for Classification",
  classification_in_review: "Classification In Review",
  ready_for_declaration: "Ready for Declaration",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const INVOICE_DOCUMENT_TYPES = new Set<string>([
  "commercial_invoice",
  "proforma_invoice",
]);

export const PACKING_LIST_DOCUMENT_TYPES = new Set<string>([
  "packing_list",
]);

export function isImportCaseStatus(value: string): value is ImportCaseStatus {
  return (IMPORT_CASE_STATUSES as readonly string[]).includes(value);
}

export function isDocumentType(value: string): value is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(value);
}

export const TARIFF_VERSION = "ETH-2024";

export const GROUPING_STATUSES = [
  "not_checked",
  "grouped",
  "ready_for_review",
  "approved",
  "cannot_group",
] as const;

export type GroupingStatus = (typeof GROUPING_STATUSES)[number];

export const GROUPING_STATUS_LABELS: Record<GroupingStatus, string> = {
  not_checked: "Not Checked",
  grouped: "Grouped",
  ready_for_review: "Ready for Review",
  approved: "Approved",
  cannot_group: "Cannot Group",
};

export const CLASSIFICATION_SOURCES = [
  "ai_suggestion",
  "reference_match",
  "manual_override",
  "expert_review",
] as const;

export type ClassificationSource = (typeof CLASSIFICATION_SOURCES)[number];
