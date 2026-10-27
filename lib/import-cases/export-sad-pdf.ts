import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SadDraft, SadItem } from "./export-sad";
import { SimplePdf } from "./simple-pdf";

const TEAL = { r: 0, g: 110, b: 110 };

function fmt(v: string | number | null | undefined): string {
  if (v == null || v === "") return "";
  return String(v);
}

function loadEccLogo(): Buffer | null {
  try {
    return readFileSync(join(process.cwd(), "public", "brand", "ecc-logo.jpg"));
  } catch {
    return null;
  }
}

function writeHeaderBand(pdf: SimplePdf, draft: SadDraft, logoName: string | null) {
  const m = 28;
  const pageW = pdf.pageWidth - m * 2;
  const y = 22;

  if (logoName) {
    pdf.drawJpeg(logoName, m, y, 48, 48);
  }

  const titleX = m + (logoName ? 56 : 0);
  pdf.setFill(TEAL);
  pdf.text("ETHIOPIAN CUSTOMS COMMISSION", titleX, y + 6, {
    size: 11,
    maxWidth: pageW - 60,
    bold: true,
  });
  pdf.resetColor();
  pdf.text("DECLARATION FORM", titleX, y + 20, {
    size: 13,
    maxWidth: pageW - 60,
    bold: true,
  });
  pdf.setFill({ r: 180, g: 83, b: 9 });
  pdf.text(draft.header.draftNote, titleX, y + 36, {
    size: 7,
    maxWidth: pageW - 60,
  });
  pdf.resetColor();

  const refX = m + pageW * 0.62;
  pdf.formBox(
    refX,
    y,
    pageW * 0.38,
    48,
    "1 DECLARATION  A. CLEARANCE OFFICE",
    [
      draft.header.caseNumber,
      `Items: ${draft.header.totalItems}   Pkgs: ${fmt(draft.header.totalPackages)}`,
    ].join("\n"),
  );

  return y + 56;
}

function writeCover(pdf: SimplePdf, draft: SadDraft, logoName: string | null) {
  const { header } = draft;
  const m = 28;
  const pageW = pdf.pageWidth - m * 2;

  pdf.beginPage();
  let y = writeHeaderBand(pdf, draft, logoName);

  const left = pageW * 0.55;
  const right = pageW * 0.45;

  pdf.formBox(
    m,
    y,
    left,
    52,
    "2 Consignor/Exporter",
    [header.consignorName, header.consignorCountry].filter(Boolean).join("\n"),
  );
  pdf.formBox(
    m + left,
    y,
    right,
    52,
    "A CLEARANCE OFFICE / Manifest",
    ["", "Office Code", "Manifest Number"].join("\n"),
  );
  y += 52;

  pdf.formBox(
    m,
    y,
    left,
    52,
    "8 Consignee/Importer",
    [
      header.consigneeName,
      header.consigneeTin ? `No  ${header.consigneeTin}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  pdf.formBox(m + left, y, right * 0.5, 26, "15 C. disp./exp. code", header.countryOfExport);
  pdf.formBox(
    m + left + right * 0.5,
    y,
    right * 0.5,
    26,
    "17 Country destin. code",
    header.countryOfDestination,
  );
  pdf.formBox(
    m + left,
    y + 26,
    right,
    26,
    "16 Country of origin",
    header.countryOfOriginSummary,
  );
  y += 52;

  pdf.formBox(
    m,
    y,
    left,
    52,
    "14 Declarant",
    "", // not stored on case yet
  );
  pdf.formBox(
    m + left,
    y,
    right * 0.55,
    26,
    "20 Delivery Terms",
    header.incoterm,
  );
  pdf.formBox(
    m + left + right * 0.55,
    y,
    right * 0.45,
    26,
    "22 Currency and total",
    [header.invoiceCurrency, header.invoiceTotal].filter(Boolean).join(" "),
  );
  pdf.formBox(m + left, y + 26, right * 0.55, 26, "23 Exchange rate", "");
  pdf.formBox(
    m + left + right * 0.55,
    y + 26,
    right * 0.45,
    26,
    "7 Declarant Ref",
    header.caseNumber,
  );
  y += 52;

  pdf.formBox(m, y, left * 0.55, 36, "18 Identity of means of transport", "");
  pdf.formBox(
    m + left * 0.55,
    y,
    left * 0.45,
    36,
    "25 Mode of transport",
    "",
  );
  pdf.formBox(
    m + left,
    y,
    right,
    36,
    "28 Financial and banking data",
    "",
  );
  y += 36;

  pdf.formBox(m, y, left * 0.5, 32, "29 Office of entry/exit", "");
  pdf.formBox(m + left * 0.5, y, left * 0.5, 32, "30 Location of goods", "");
  pdf.formBox(
    m + left,
    y,
    right,
    32,
    "40 Waybill / B/L / AWB",
    header.waybillRef,
  );
  y += 32;

  // Invoice details (box 24 style)
  pdf.formBox(
    m,
    y,
    pageW,
    56,
    "24 Invoice Details",
    [
      `Ex. Freight     ${fmt(header.freightAmount)}`,
      `Insurance       ${fmt(header.insuranceAmount)}`,
      `Est. CIF/Total  ${fmt(header.estimatedCif) || fmt(header.invoiceTotal)}`,
      `Currency        ${fmt(header.invoiceCurrency)}`,
    ].join("\n"),
  );
  y += 60;

  const first = draft.items[0];
  if (first) {
    writeItemBlock(pdf, m, y, pageW, first, false);
  } else {
    pdf.setFill(TEAL);
    pdf.text("No declaration items", m, y, { size: 9, maxWidth: pageW });
    pdf.resetColor();
  }

  pdf.endPage();
}

function writeItemBlock(
  pdf: SimplePdf,
  m: number,
  startY: number,
  pageW: number,
  item: SadItem,
  withTitle: boolean,
) {
  let y = startY;
  if (withTitle) {
    pdf.setFill(TEAL);
    pdf.text(
      `Item ${item.itemNo}  ·  Group ${item.groupCode}`,
      m,
      y,
      { size: 8, maxWidth: pageW, bold: true },
    );
    pdf.resetColor();
    y += 12;
  }

  const mid = pageW * 0.62;
  pdf.formBox(
    m,
    y,
    mid,
    70,
    "31 Packages and description of goods",
    [
      item.numberOfPackages != null
        ? `${item.numberOfPackages} ${item.packageType ?? "PK"}`
        : (item.packageType ?? ""),
      item.description,
    ]
      .filter(Boolean)
      .join("\n"),
    { bodySize: 7 },
  );
  pdf.formBox(
    m + mid,
    y,
    pageW - mid,
    28,
    "33 Commodity Code",
    item.hsCode,
  );
  pdf.formBox(
    m + mid,
    y + 28,
    (pageW - mid) * 0.5,
    21,
    "34 Country of origin",
    item.countryOfOriginCode,
  );
  pdf.formBox(
    m + mid + (pageW - mid) * 0.5,
    y + 28,
    (pageW - mid) * 0.5,
    21,
    "32 Item No",
    String(item.itemNo),
  );
  pdf.formBox(
    m + mid,
    y + 49,
    (pageW - mid) * 0.5,
    21,
    "35 Gross Mass (kg)",
    fmt(item.grossMassKg),
  );
  pdf.formBox(
    m + mid + (pageW - mid) * 0.5,
    y + 49,
    (pageW - mid) * 0.5,
    21,
    "38 Net mass (kg)",
    fmt(item.netMassKg),
  );
  y += 70;

  pdf.formBox(m, y, pageW * 0.25, 28, "37 PROCEDURE", item.procedureCode);
  pdf.formBox(
    m + pageW * 0.25,
    y,
    pageW * 0.25,
    28,
    "41 Supplementary units",
    `${fmt(item.supplementaryQty)} ${item.unitOfMeasure}`,
  );
  pdf.formBox(
    m + pageW * 0.5,
    y,
    pageW * 0.25,
    28,
    "42 Item price",
    [item.currencyCode, fmt(item.itemPrice)].filter(Boolean).join(" "),
  );
  pdf.formBox(
    m + pageW * 0.75,
    y,
    pageW * 0.25,
    28,
    "Duty rate",
    item.dutyRateDisplay,
  );
  y += 28;

  const taxLines = item.taxes
    .map(
      (t) =>
        `${t.type}  rate ${fmt(t.rate)}  base ${fmt(t.base)}  amt ${fmt(t.amount)}`,
    )
    .join("\n");
  pdf.formBox(m, y, pageW, 48, "47 Taxes & duties (estimated)", taxLines || " ", {
    bodySize: 7,
  });
  return y + 48;
}

function writeItemPage(
  pdf: SimplePdf,
  draft: SadDraft,
  item: SadItem,
  logoName: string | null,
  pageIndex: number,
  pageTotal: number,
) {
  const m = 28;
  const pageW = pdf.pageWidth - m * 2;
  pdf.beginPage();
  let y = writeHeaderBand(pdf, draft, logoName);
  pdf.setFill(TEAL);
  pdf.text(
    `Continuation sheet  ${pageIndex}/${pageTotal}  ·  Consignee ${draft.header.consigneeName || "-"}`,
    m,
    y,
    { size: 8, maxWidth: pageW },
  );
  pdf.resetColor();
  y += 14;
  writeItemBlock(pdf, m, y, pageW, item, true);
  pdf.endPage();
}

function writeUnclassifiedAppendix(pdf: SimplePdf, draft: SadDraft) {
  const m = 28;
  const pageW = pdf.pageWidth - m * 2;
  pdf.beginPage();
  let y = 28;
  pdf.setFill(TEAL);
  y = pdf.text("Unclassified products (not in SAD items)", m, y, {
    size: 11,
    maxWidth: pageW,
    bold: true,
  });
  pdf.setFill({ r: 180, g: 83, b: 9 });
  y = pdf.text(
    "These products are not covered by declaration groups and must be resolved before filing.",
    m,
    y + 4,
    { size: 8, maxWidth: pageW },
  );
  pdf.resetColor();
  y += 10;
  for (const u of draft.unclassified) {
    if (y > pdf.pageHeight - 60) {
      pdf.endPage();
      pdf.beginPage();
      y = 28;
    }
    y = pdf.text(
      `#${u.sequence}  ${u.description}  | qty ${fmt(u.quantity)} ${u.unit ?? ""} | HS ${fmt(u.hsCode)} | ${u.reason}`,
      m,
      y,
      { size: 8, maxWidth: pageW },
    );
    y += 4;
  }
  pdf.endPage();
}

/** Multi-page SAD-style draft PDF (ECC form layout + logo). */
export async function generateSadPdf(draft: SadDraft): Promise<Buffer> {
  const pdf = new SimplePdf();
  const logoBuf = loadEccLogo();
  const logoName = logoBuf ? pdf.registerJpeg(logoBuf) : null;

  writeCover(pdf, draft, logoName);
  // First item is already on cover; continuation for the rest
  const rest = draft.items.slice(1);
  rest.forEach((item, i) => {
    writeItemPage(pdf, draft, item, logoName, i + 2, draft.items.length);
  });
  if (draft.unclassified.length > 0) {
    writeUnclassifiedAppendix(pdf, draft);
  }
  return pdf.toBuffer();
}
