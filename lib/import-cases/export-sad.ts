/**
 * Ethiopian Customs SAD (declaration form) draft model.
 * One SAD item = one product group. Official ASYCUDA-only fields stay blank.
 */

import { DESTINATION_ISO2 } from "@/lib/country-codes";
import type { ImportCaseRow } from "@/db/schema/importCases";
import type { TariffSnapshotRow } from "@/db/schema/tariffSnapshots";
import { formatHsCode } from "@/lib/hs-code-format";
import { formatDutyRateFromSnapshot } from "./duty-rate-display";
import type { CaseOriginData } from "./origin-load";
import {
  displayOrigin,
  ORIGIN_NOT_PROVIDED,
  resolveProductOrigin,
} from "./origin";
import type { GroupingWithProducts } from "./grouping-queries";
import type { UnclassifiedProduct } from "./unclassified";

export type SadExportExtras = {
  unclassified?: UnclassifiedProduct[];
  origins?: CaseOriginData;
};

function sadHsCode(code: string | null | undefined): string {
  if (!code || !code.trim()) return "";
  const f = formatHsCode(code);
  if (f.digits.length < 4) return code.trim();
  return f.incomplete ? `${f.display} (incomplete)` : f.display;
}

function sadGroupOrigin(
  group: GroupingWithProducts,
  origins: CaseOriginData | undefined,
): string {
  const stored = displayOrigin(group.grouping.countryOfOriginCode);
  if (stored !== ORIGIN_NOT_PROVIDED) return stored;
  for (const { product } of group.products) {
    const lines = origins?.byProduct.get(product.id);
    const fromProduct = displayOrigin(
      resolveProductOrigin({
        productOrigin: product.countryOfOriginCode,
        invoiceOrigins: lines?.invoice,
        packingOrigins: lines?.packing,
        caseOrigin: origins?.caseOrigin,
      }),
    );
    if (fromProduct !== ORIGIN_NOT_PROVIDED) return fromProduct;
  }
  return ORIGIN_NOT_PROVIDED;
}

export type SadTaxLine = {
  type: string;
  rate: string | null;
  base: number | null;
  amount: number | null;
};

export type SadItem = {
  itemNo: number;
  groupCode: string;
  hsCode: string;
  countryOfOriginCode: string;
  procedureCode: string;
  description: string;
  numberOfPackages: number | null;
  packageType: string | null;
  netMassKg: number | null;
  grossMassKg: number | null;
  supplementaryQty: number | null;
  unitOfMeasure: string;
  itemPrice: number | null;
  currencyCode: string | null;
  dutyRateDisplay: string;
  taxes: SadTaxLine[];
  waybillRef: string;
};

export type SadHeader = {
  caseNumber: string;
  draftNote: string;
  consignorName: string;
  consignorCountry: string;
  consigneeName: string;
  consigneeTin: string;
  countryOfExport: string;
  countryOfDestination: string;
  countryOfOriginSummary: string;
  incoterm: string;
  invoiceCurrency: string;
  invoiceTotal: string;
  freightAmount: string;
  insuranceAmount: string;
  estimatedCif: string;
  waybillRef: string;
  procedureCode: string;
  totalPackages: number | null;
  totalItems: number;
  formsCount: number;
};

export type SadDraft = {
  header: SadHeader;
  items: SadItem[];
  unclassified: UnclassifiedProduct[];
};

function num(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: string | null | undefined): string {
  return (v ?? "").trim();
}

function sumNullable(values: Array<number | null>): number | null {
  let total = 0;
  let any = false;
  for (const v of values) {
    if (v == null) continue;
    total += v;
    any = true;
  }
  return any ? total : null;
}

function productPrice(product: {
  lineTotalAmount: string | null;
  quantity: string | null;
  unitPrice: string | null;
}): number | null {
  const line = num(product.lineTotalAmount);
  if (line != null) return line;
  const qty = num(product.quantity);
  const unit = num(product.unitPrice);
  if (qty != null && unit != null) return qty * unit;
  return null;
}

function truncateDesc(parts: string[], max = 400): string {
  const joined = parts.filter(Boolean).join("; ");
  if (joined.length <= max) return joined;
  return `${joined.slice(0, max - 1)}…`;
}

function taxLines(
  snapshot: TariffSnapshotRow | null | undefined,
  itemPrice: number | null,
): SadTaxLine[] {
  if (!snapshot) return [];
  const base = itemPrice;
  const lines: Array<{ type: string; rateRaw: string | null }> = [
    { type: "01 Duty", rateRaw: snapshot.customsDutyRate },
    { type: "03 VAT", rateRaw: snapshot.vatRate },
    { type: "04 Excise", rateRaw: snapshot.exciseRate },
    { type: "05 Surtax", rateRaw: snapshot.surtaxRate },
  ];
  return lines.map(({ type, rateRaw }) => {
    const rate = num(rateRaw);
    const amount =
      base != null && rate != null ? Math.round(base * (rate / 100) * 100) / 100 : null;
    return {
      type,
      rate: rateRaw,
      base,
      amount,
    };
  });
}

function waybillFromCase(c: ImportCaseRow): string {
  return (
    str(c.billOfLadingNumber) ||
    str(c.airwayBillNumber) ||
    str(c.shipmentReference)
  );
}

/** Map case + groups into a SAD draft for PDF/Excel export. */
export function buildSadDraft(
  importCase: ImportCaseRow,
  groupings: GroupingWithProducts[],
  extras: SadExportExtras = {},
): SadDraft {
  const origins = extras.origins;
  const unclassified = extras.unclassified ?? [];
  const waybill = waybillFromCase(importCase);
  const currency = str(importCase.invoiceCurrencyCode) || null;

  const items: SadItem[] = groupings.map((g, index) => {
    const products = g.products.map((p) => p.product);
    const descriptions = products.map(
      (p) =>
        str(p.normalizedDescription) ||
        str(p.productName) ||
        str(p.rawDescription),
    );
    const packages = sumNullable(products.map((p) => num(p.numberOfPackages)));
    const packageTypes = [
      ...new Set(products.map((p) => str(p.packageType)).filter(Boolean)),
    ];
    const netMass = sumNullable(products.map((p) => num(p.netWeightKg)));
    const grossMass = sumNullable(products.map((p) => num(p.grossWeightKg)));
    const qty = sumNullable(products.map((p) => num(p.quantity)));
    const itemPrice = sumNullable(products.map((p) => productPrice(p)));
    const snapshot = g.products[0]?.tariffSnapshot ?? null;
    const procedure =
      str(g.grouping.procedureCode) ||
      str(importCase.importProcedureCode);

    return {
      itemNo: index + 1,
      groupCode: g.grouping.groupCode,
      hsCode: sadHsCode(g.grouping.hsCode),
      countryOfOriginCode: sadGroupOrigin(g, origins),
      procedureCode: procedure,
      description: truncateDesc(descriptions),
      numberOfPackages: packages,
      packageType: packageTypes[0] ?? null,
      netMassKg: netMass,
      grossMassKg: grossMass,
      supplementaryQty: qty ?? g.totalQuantity,
      unitOfMeasure: str(g.grouping.unitOfMeasure) || "PCS",
      itemPrice,
      currencyCode: currency,
      dutyRateDisplay: formatDutyRateFromSnapshot(snapshot) ?? "",
      taxes: taxLines(snapshot, itemPrice),
      waybillRef: waybill,
    };
  });

  const packageSum = sumNullable(items.map((i) => i.numberOfPackages));
  const originSummary =
    [...new Set(items.map((i) => i.countryOfOriginCode).filter(Boolean))].join(
      ", ",
    ) || str(importCase.countryOfOriginCode);

  const formsCount = 1 + Math.max(0, items.length); // cover + one continuation idea

  return {
    header: {
      caseNumber: importCase.caseNumber,
      draftNote: "DRAFT — not an official customs filing",
      consignorName: str(importCase.supplierName),
      consignorCountry: str(importCase.supplierCountryCode),
      consigneeName: str(importCase.importerName),
      consigneeTin: str(importCase.importerTinNumber),
      countryOfExport: str(importCase.countryOfExportCode),
      countryOfDestination: DESTINATION_ISO2,
      countryOfOriginSummary: originSummary,
      incoterm: str(importCase.incoterm),
      invoiceCurrency: currency ?? "",
      invoiceTotal: str(importCase.invoiceTotalAmount),
      freightAmount: str(importCase.freightAmount),
      insuranceAmount: str(importCase.insuranceAmount),
      estimatedCif: str(importCase.estimatedCifAmount),
      waybillRef: waybill,
      procedureCode: str(importCase.importProcedureCode),
      totalPackages: packageSum,
      totalItems: items.length,
      formsCount,
    },
    items,
    unclassified,
  };
}
