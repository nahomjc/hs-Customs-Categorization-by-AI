/**
 * Offline self-check for Ethiopian Customs SAD draft mapper.
 *
 *   npm run test:export-sad
 */
import assert from "node:assert/strict";
import type { ImportCaseRow } from "../db/schema/importCases";
import type { ImportProductRow } from "../db/schema/importProducts";
import type { ProductGroupingRow } from "../db/schema/productGroupings";
import { buildSadDraft } from "../lib/import-cases/export-sad";
import { generateSadExcel } from "../lib/import-cases/export-sad-excel";
import { generateSadPdf } from "../lib/import-cases/export-sad-pdf";
import type { GroupingWithProducts } from "../lib/import-cases/grouping-queries";

const now = new Date();

const importCase = {
  id: "case-1",
  tenantId: "t1",
  caseNumber: "IC-TEST-001",
  status: "ready_for_declaration",
  importerName: "Test Importer PLC",
  importerTinNumber: "0001234567",
  supplierId: null,
  supplierName: "Supplier FZE",
  supplierCountryCode: "CN",
  countryOfExportCode: "CN",
  countryOfOriginCode: "CN",
  shipmentReference: "SHP-1",
  billOfLadingNumber: "BL123",
  airwayBillNumber: null,
  importProcedureCode: "4000",
  incoterm: "FCA",
  invoiceCurrencyCode: "USD",
  invoiceTotalAmount: "1000.00",
  freightAmount: "50.00",
  insuranceAmount: "10.00",
  estimatedCifAmount: "1060.00",
  assignedAgentId: null,
  clientUserId: null,
  trackingStatus: "received",
  trackingNote: null,
  trackingUpdatedAt: null,
  trackingUpdatedByUserId: null,
  createdByUserId: "user-1",
  notes: null,
  createdAt: now,
  updatedAt: now,
} satisfies ImportCaseRow;

const product1 = {
  id: "prod-1",
  importCaseId: "case-1",
  productSequence: 1,
  status: "approved",
  rawDescription: "Dried beans",
  normalizedDescription: "Dried beans",
  productName: null,
  brand: null,
  modelNumber: null,
  manufacturer: null,
  material: null,
  intendedUse: null,
  productType: null,
  technicalSpecifications: null,
  quantity: "10",
  unitOfMeasure: "KG",
  unitPrice: "5.00",
  lineTotalAmount: "50.00",
  currencyCode: "USD",
  countryOfOriginCode: "CN",
  netWeightKg: "10",
  grossWeightKg: "12",
  packageType: "PK",
  numberOfPackages: "2",
  missingInformation: [],
  normalizationConfidence: null,
  humanVerified: false,
  verifiedByUserId: null,
  verifiedAt: null,
  createdAt: now,
  updatedAt: now,
} satisfies ImportProductRow;

const product2: ImportProductRow = {
  ...product1,
  id: "prod-2",
  productSequence: 2,
  rawDescription: "Pepper",
  normalizedDescription: "Pepper",
  lineTotalAmount: "30.00",
  quantity: "5",
};

const grouping1 = {
  id: "grp-1",
  importCaseId: "case-1",
  groupCode: "GRP-001",
  status: "ready",
  hsCode: "20089900",
  countryOfOriginCode: "CN",
  procedureCode: "4000",
  taxProfileHash: "abc",
  unitOfMeasure: "KG",
  groupingReason: "same HS",
  cannotGroupReason: null,
  reviewedByUserId: null,
  reviewedAt: null,
  createdAt: now,
  updatedAt: now,
} satisfies ProductGroupingRow;

const groups: GroupingWithProducts[] = [
  {
    grouping: grouping1,
    products: [
      {
        product: product1,
        classification: null,
        tariffSnapshot: {
          id: "ts-1",
          productId: "prod-1",
          hsCode: "20089900",
          tariffVersion: "v1",
          countryOfOriginCode: "CN",
          procedureCode: "4000",
          customsDutyRate: "35",
          vatRate: "15",
          exciseRate: "0",
          surtaxRate: "10",
          otherCharges: null,
          permitRequirements: [],
          restrictions: [],
          sourceReference: null,
          retrievedAt: now,
        },
      },
    ],
    totalQuantity: 10,
  },
  {
    grouping: { ...grouping1, id: "grp-2", groupCode: "GRP-002", hsCode: "09041100" },
    products: [
      {
        product: product2,
        classification: null,
        tariffSnapshot: null,
      },
    ],
    totalQuantity: 5,
  },
];

const draft = buildSadDraft(importCase, groups, {
  unclassified: [
    {
      productId: "u1",
      sequence: 99,
      description: "Unclassified widget",
      quantity: "1",
      unit: "PCS",
      hsCode: null,
      reason: "no approved HS",
    },
  ],
});

assert.equal(draft.items.length, 2, "one SAD item per group");
assert.equal(draft.items[0].hsCode, "2008.9900");
assert.equal(draft.items[0].itemNo, 1);
assert.equal(draft.items[0].itemPrice, 50);
assert.equal(draft.header.consigneeTin, "0001234567");
assert.equal(draft.header.waybillRef, "BL123");
assert.equal(draft.header.countryOfDestination, "ET");
assert.equal(draft.header.totalItems, 2);
assert.equal(draft.unclassified.length, 1);
assert.ok(
  draft.items[0].taxes.some((t) => t.type === "01 Duty" && t.rate === "35"),
);
assert.match(draft.header.draftNote, /DRAFT/);

async function main() {
  const pdf = await generateSadPdf(draft);
  const xlsx = await generateSadExcel(draft);
  assert.ok(pdf.length > 100, "PDF buffer non-empty");
  assert.equal(pdf.subarray(0, 5).toString("utf8"), "%PDF-");
  assert.ok(xlsx.length > 100, "Excel buffer non-empty");
  console.log("PASS test-export-sad: buildSadDraft + PDF + Excel");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
