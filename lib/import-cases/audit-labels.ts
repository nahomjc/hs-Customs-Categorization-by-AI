const ACTION_LABELS: Record<string, string> = {
  import_case_created: "Created import case",
  import_case_updated: "Updated case details",
  document_uploaded: "Uploaded document",
  document_updated: "Updated document",
  document_extracted: "Extracted document data",
  document_extraction_failed: "Document extraction failed",
  invoice_line_created: "Added invoice line",
  invoice_line_corrected: "Corrected invoice line",
  packing_line_created: "Added packing list line",
  packing_line_corrected: "Corrected packing list line",
  invoice_lines_bulk_approve: "Bulk approved invoice lines",
  invoice_lines_bulk_override: "Bulk overrode invoice lines",
  invoice_lines_bulk_reject: "Bulk rejected invoice lines",
  packing_lines_bulk_approve: "Bulk approved packing lines",
  packing_lines_bulk_override: "Bulk overrode packing lines",
  packing_lines_bulk_reject: "Bulk rejected packing lines",
  checks_bulk_approve: "Bulk approved checks",
  checks_bulk_override: "Bulk overrode checks",
  checks_bulk_reject: "Bulk rejected checks",
  products_bulk_approve: "Bulk verified products",
  products_bulk_override: "Bulk overrode products",
  products_bulk_reject: "Bulk rejected products",
  classifications_bulk_approve: "Bulk approved classifications",
  classifications_bulk_override: "Bulk overrode classifications",
  classifications_bulk_reject: "Bulk rejected classifications",
  product_harmonized: "Harmonized products",
  product_updated: "Updated product",
  product_verified: "Verified product",
  classification_suggested: "Suggested HS classifications",
  classification_ai_requested: "Requested AI HS classification",
  classification_approved: "Approved classification",
  grouping_created: "Created declaration groupings",
  export_generated: "Generated export report",
};

function humanizeAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? humanizeAction(action);
}

export function formatAuditDetails(
  action: string,
  newData: Record<string, unknown> | null,
): string | null {
  if (!newData) return null;

  const parts: string[] = [];

  if (typeof newData.count === "number") {
    parts.push(`${newData.count} item(s)`);
  }
  if (typeof newData.lineCount === "number") {
    parts.push(`${newData.lineCount} line(s)`);
  }
  if (typeof newData.productCount === "number") {
    parts.push(`${newData.productCount} product(s)`);
  }
  if (typeof newData.classifiedCount === "number") {
    parts.push(`${newData.classifiedCount} classified`);
  }
  if (typeof newData.groupCount === "number") {
    parts.push(`${newData.groupCount} group(s)`);
  }
  if (typeof newData.documentType === "string") {
    parts.push(newData.documentType.replace(/_/g, " "));
  }
  if (typeof newData.hsCode === "string") {
    parts.push(`HS ${newData.hsCode}`);
  }
  if (typeof newData.format === "string") {
    parts.push(newData.format.toUpperCase());
  }
  if (typeof newData.error === "string") {
    parts.push(newData.error);
  }
  if (typeof newData.caseNumber === "string") {
    parts.push(newData.caseNumber);
  }

  if (parts.length === 0 && action.includes("bulk")) {
    return null;
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}
