import type { GroupingWithProducts } from "./grouping-queries";
import { resolveDutyRateDisplay } from "./tariff-lookup";

function escapeCsvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(
  headers: string[],
  rows: (string | number | null)[][],
): string {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];
  return lines.join("\r\n");
}

export function generateDeclarationCsv(
  caseNumber: string,
  groupings: GroupingWithProducts[],
): Buffer {
  const sections: string[] = [];

  sections.push(
    rowsToCsv(
      [
        "Group Code",
        "HS Code",
        "Country of Origin",
        "Procedure",
        "Unit",
        "Total Qty",
        "Product Count",
        "Duty Rate",
        "Grouping Reason",
      ],
      groupings.map((g) => [
        g.grouping.groupCode,
        g.grouping.hsCode ?? "",
        g.grouping.countryOfOriginCode ?? "",
        g.grouping.procedureCode ?? "",
        g.grouping.unitOfMeasure ?? "PCS",
        g.totalQuantity,
        g.products.length,
        resolveDutyRateDisplay(g.products[0]?.tariffSnapshot ?? null),
        g.grouping.groupingReason ?? "",
      ]),
    ),
  );

  const lineRows: (string | number | null)[][] = [];
  for (const g of groupings) {
    for (const { product, classification, tariffSnapshot } of g.products) {
      lineRows.push([
        g.grouping.groupCode,
        product.productSequence,
        classification?.hsCode ?? g.grouping.hsCode ?? "",
        product.normalizedDescription ?? product.rawDescription,
        product.quantity ?? "",
        product.unitOfMeasure ?? "",
        product.countryOfOriginCode ?? "",
        resolveDutyRateDisplay(tariffSnapshot),
        product.brand ?? "",
        product.modelNumber ?? "",
      ]);
    }
  }

  if (lineRows.length > 0) {
    sections.push(
      rowsToCsv(
        [
          "Group Code",
          "Product #",
          "HS Code",
          "Description",
          "Quantity",
          "Unit",
          "Origin",
          "Duty Rate",
          "Brand",
          "Model",
        ],
        lineRows,
      ),
    );
  }

  const header = `# Declaration export — ${caseNumber}\r\n# Generated for customs declaration preparation (decision support only)\r\n\r\n`;
  return Buffer.from(header + sections.join("\r\n\r\n"), "utf-8");
}
