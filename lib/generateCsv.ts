import type { GroupedItem } from "./groupItems";
import { isExcludedHsCode, isNonItemCategory } from "./allowedHsCodes";
import type { LineItemExportRow } from "./generateExcel";

function escapeCsvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];
  return lines.join("\r\n");
}

export function generateCategorizedCsv(
  grouped: GroupedItem[],
  options?: { lineItems?: LineItemExportRow[] }
): Buffer {
  const filtered = grouped.filter(
    (row) => !isExcludedHsCode(row.hsCode) && !isNonItemCategory(row.category)
  );

  const lineItems = options?.lineItems ?? [];
  const sections: string[] = [];

  if (lineItems.length > 0) {
    sections.push(
      rowsToCsv(
        [
          "Line #",
          "Description",
          "Document HS",
          "Classified HS",
          "Category",
          "Qty",
          "Unit",
          "Specification",
          "Review",
        ],
        lineItems.map((r) => [
          r.lineNumber,
          r.description,
          r.sourceHsCode,
          r.classifiedHsCode,
          r.category,
          r.quantity,
          r.unit,
          r.specification,
          r.reviewFlag,
        ])
      )
    );
  }

  sections.push(
    rowsToCsv(
      ["HS Code", "Category", "Description", "Total Qty", "Unit"],
      filtered.map((r) => [
        r.hsCode,
        r.category,
        r.finalDescription,
        r.totalQuantity,
        r.unit ?? "CTNS",
      ])
    )
  );

  return Buffer.from(sections.join("\r\n\r\n"), "utf-8");
}
