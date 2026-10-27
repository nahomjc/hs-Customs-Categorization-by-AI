import ExcelJS from "exceljs";
import type { SadDraft } from "./export-sad";

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E7F0" },
  };
}

function addLabelValue(
  sheet: ExcelJS.Worksheet,
  label: string,
  value: string | number | null | undefined,
) {
  const row = sheet.addRow([label, value ?? ""]);
  row.getCell(1).font = { bold: true };
}

/** SAD draft workbook: Header + Items (+ Unclassified). */
export async function generateSadExcel(draft: SadDraft): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Impact Logistics";
  wb.created = new Date();

  const header = wb.addWorksheet("Header");
  header.columns = [{ width: 36 }, { width: 48 }];
  addLabelValue(header, "Document", "ETHIOPIAN CUSTOMS COMMISSION — SAD DRAFT");
  addLabelValue(header, "Note", draft.header.draftNote);
  addLabelValue(header, "Case number / Declarant ref (7)", draft.header.caseNumber);
  addLabelValue(header, "2 Consignor/Exporter", draft.header.consignorName);
  addLabelValue(header, "2 Country", draft.header.consignorCountry);
  addLabelValue(header, "8 Consignee/Importer", draft.header.consigneeName);
  addLabelValue(header, "8 TIN", draft.header.consigneeTin);
  addLabelValue(header, "14 Declarant", "");
  addLabelValue(header, "15 Country of dispatch/export", draft.header.countryOfExport);
  addLabelValue(header, "16 Country of origin", draft.header.countryOfOriginSummary);
  addLabelValue(header, "17 Country of destination", draft.header.countryOfDestination);
  addLabelValue(header, "18 Transport identity", "");
  addLabelValue(header, "20 Delivery terms", draft.header.incoterm);
  addLabelValue(header, "22 Currency", draft.header.invoiceCurrency);
  addLabelValue(header, "22 Total amount invoiced", draft.header.invoiceTotal);
  addLabelValue(header, "23 Exchange rate", "");
  addLabelValue(header, "25 Mode of transport", "");
  addLabelValue(header, "28 Financial / banking", "");
  addLabelValue(header, "29 Office of entry/exit", "");
  addLabelValue(header, "30 Location of goods", "");
  addLabelValue(header, "37 Procedure (case)", draft.header.procedureCode);
  addLabelValue(header, "40 Waybill / B/L / AWB", draft.header.waybillRef);
  addLabelValue(header, "Invoice freight", draft.header.freightAmount);
  addLabelValue(header, "Invoice insurance", draft.header.insuranceAmount);
  addLabelValue(header, "Estimated CIF", draft.header.estimatedCif);
  addLabelValue(header, "5 Items", draft.header.totalItems);
  addLabelValue(header, "6 Tot. packages", draft.header.totalPackages);
  addLabelValue(header, "3 Forms", draft.header.formsCount);
  addLabelValue(header, "Registration number & date", "");
  addLabelValue(header, "Assessment number & date", "");
  addLabelValue(header, "Receipt number & date", "");

  const items = wb.addWorksheet("Items");
  const itemHeaders = [
    "32 Item No",
    "Group Code",
    "33 Commodity Code (HS)",
    "34 Country of origin",
    "37 Procedure",
    "31 Description of goods",
    "31 Packages (qty)",
    "31 Package type",
    "35 Gross mass (kg)",
    "38 Net mass (kg)",
    "41 Supplementary units",
    "41 UoM",
    "42 Item price",
    "Currency",
    "Duty rate",
    "47 Duty amount (est.)",
    "47 VAT amount (est.)",
    "47 Excise amount (est.)",
    "47 Surtax amount (est.)",
    "40 Waybill",
  ];
  const headerRow = items.addRow(itemHeaders);
  styleHeader(headerRow);
  items.columns = itemHeaders.map((h) => ({
    header: h,
    width: Math.min(28, Math.max(12, h.length + 2)),
  }));

  for (const item of draft.items) {
    const byType = Object.fromEntries(item.taxes.map((t) => [t.type, t]));
    items.addRow([
      item.itemNo,
      item.groupCode,
      item.hsCode,
      item.countryOfOriginCode,
      item.procedureCode,
      item.description,
      item.numberOfPackages,
      item.packageType,
      item.grossMassKg,
      item.netMassKg,
      item.supplementaryQty,
      item.unitOfMeasure,
      item.itemPrice,
      item.currencyCode,
      item.dutyRateDisplay,
      byType["01 Duty"]?.amount ?? "",
      byType["03 VAT"]?.amount ?? "",
      byType["04 Excise"]?.amount ?? "",
      byType["05 Surtax"]?.amount ?? "",
      item.waybillRef,
    ]);
  }

  if (draft.unclassified.length > 0) {
    const unc = wb.addWorksheet("Unclassified");
    const uHeaders = [
      "Product #",
      "Description",
      "Quantity",
      "Unit",
      "HS on file",
      "Reason",
    ];
    styleHeader(unc.addRow(uHeaders));
    unc.columns = uHeaders.map((h) => ({ width: 22 }));
    for (const u of draft.unclassified) {
      unc.addRow([
        u.sequence,
        u.description,
        u.quantity,
        u.unit,
        u.hsCode,
        u.reason,
      ]);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
