import { formatHsCode } from "@/lib/hs-code-format";
import type { GroupingWithProducts } from "./grouping-queries";
import { resolveProductOrigin, displayOrigin, ORIGIN_NOT_PROVIDED } from "./origin";
import type { CaseOriginData } from "./origin-load";
import { resolveDutyRateDisplay } from "./tariff-lookup";
import type { UnclassifiedProduct } from "./unclassified";

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

export type DeclarationExportExtras = {
  /** Products that are in no group: written in their own marked section. */
  unclassified?: UnclassifiedProduct[];
  /** Real origin data of the case (invoice / packing lines, case fallback). */
  origins?: CaseOriginData;
};

/** "8703.1020" (complete) or "1601 (incomplete)": one format, gaps are visible. */
export function exportHsCode(code: string | null | undefined): string {
  if (!code || !code.trim()) return "";
  const f = formatHsCode(code);
  if (f.digits.length < 4) return code.trim();
  return f.incomplete ? `${f.display} (incomplete)` : f.display;
}

type ProductForOrigin = { id: string; countryOfOriginCode: string | null };

/** Origin text for one product: stored data only, else "Not provided". */
export function exportProductOrigin(
  product: ProductForOrigin,
  origins: CaseOriginData | undefined,
): string {
  const lines = origins?.byProduct.get(product.id);
  return displayOrigin(
    resolveProductOrigin({
      productOrigin: product.countryOfOriginCode,
      invoiceOrigins: lines?.invoice,
      packingOrigins: lines?.packing,
      caseOrigin: origins?.caseOrigin,
    }),
  );
}

/** Origin text for a group: what the group stored, else what its products have. */
export function exportGroupOrigin(
  group: GroupingWithProducts,
  origins: CaseOriginData | undefined,
): string {
  const stored = displayOrigin(group.grouping.countryOfOriginCode);
  if (stored !== ORIGIN_NOT_PROVIDED) return stored;
  for (const { product } of group.products) {
    const fromProduct = exportProductOrigin(product, origins);
    if (fromProduct !== ORIGIN_NOT_PROVIDED) return fromProduct;
  }
  return ORIGIN_NOT_PROVIDED;
}

export function generateDeclarationCsv(
  caseNumber: string,
  groupings: GroupingWithProducts[],
  extras: DeclarationExportExtras = {},
): Buffer {
  const sections: string[] = [];
  const unclassified = extras.unclassified ?? [];
  const origins = extras.origins;

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
        exportHsCode(g.grouping.hsCode),
        exportGroupOrigin(g, origins),
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
        exportHsCode(classification?.hsCode ?? g.grouping.hsCode),
        product.normalizedDescription ?? product.rawDescription,
        product.quantity ?? "",
        product.unitOfMeasure ?? "",
        exportProductOrigin(product, origins),
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

  if (unclassified.length > 0) {
    sections.push(
      [
        `# UNCLASSIFIED - ${unclassified.length} product(s) are NOT in any declaration group and are not covered by the groups above`,
        rowsToCsv(
          ["Product #", "Description", "Quantity", "Unit", "HS Code on file", "Why it is not grouped"],
          unclassified.map((u) => [
            u.sequence,
            u.description,
            u.quantity ?? "",
            u.unit ?? "",
            exportHsCode(u.hsCode),
            u.reason,
          ]),
        ),
      ].join("\r\n"),
    );
  }

  const groupedCount = groupings.reduce((n, g) => n + g.products.length, 0);
  const header = [
    `# Declaration export - ${caseNumber}`,
    "# Generated for customs declaration preparation (decision support only)",
    `# Products: ${groupedCount + unclassified.length} in total, ${groupedCount} in ${groupings.length} group(s), ${unclassified.length} unclassified`,
    "# HS codes marked (incomplete) have fewer than 8 digits and need a full code before filing",
    "",
    "",
  ].join("\r\n");
  return Buffer.from(header + sections.join("\r\n\r\n"), "utf-8");
}