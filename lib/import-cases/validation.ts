import { z } from "zod";
import { DOCUMENT_TYPES, IMPORT_CASE_STATUSES } from "./constants";

export const createImportCaseSchema = z.object({
  importerName: z.string().trim().min(1, "Importer name is required").max(255),
  supplierName: z.string().trim().max(255).optional().nullable(),
  countryOfExportCode: z.string().trim().max(3).optional().nullable(),
  countryOfOriginCode: z.string().trim().max(3).optional().nullable(),
  shipmentReference: z.string().trim().max(100).optional().nullable(),
  importProcedureCode: z.string().trim().max(50).optional().nullable(),
  incoterm: z.string().trim().max(20).optional().nullable(),
  assignedAgentId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
});

export const updateImportCaseSchema = createImportCaseSchema
  .partial()
  .extend({
    status: z.enum(IMPORT_CASE_STATUSES).optional(),
    importerTinNumber: z.string().trim().max(50).optional().nullable(),
    billOfLadingNumber: z.string().trim().max(100).optional().nullable(),
    airwayBillNumber: z.string().trim().max(100).optional().nullable(),
    invoiceCurrencyCode: z.string().trim().max(3).optional().nullable(),
    invoiceTotalAmount: z.string().trim().optional().nullable(),
    freightAmount: z.string().trim().optional().nullable(),
    insuranceAmount: z.string().trim().optional().nullable(),
    estimatedCifAmount: z.string().trim().optional().nullable(),
  });

export const listImportCasesQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(IMPORT_CASE_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const uploadDocumentSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
});

export const updateDocumentSchema = z.object({
  documentNumber: z.string().trim().max(100).optional().nullable(),
  relatedInvoiceNumber: z.string().trim().max(100).optional().nullable(),
  documentDate: z.string().datetime().optional().nullable(),
  reviewDecision: z.enum(["approved", "rejected"]).optional(),
  rejectionReason: z.string().trim().max(2000).optional().nullable(),
});

export const createInvoiceLineSchema = z.object({
  documentId: z.string().uuid(),
  lineNumber: z.number().int().min(1).optional(),
  supplierDescription: z.string().trim().min(1).max(5000),
  supplierSku: z.string().trim().max(100).optional().nullable(),
  brand: z.string().trim().max(100).optional().nullable(),
  modelNumber: z.string().trim().max(100).optional().nullable(),
  quantity: z.string().trim().min(1),
  unitOfMeasure: z.string().trim().min(1).max(30),
  unitPrice: z.string().trim().optional().nullable(),
  lineTotalAmount: z.string().trim().optional().nullable(),
  currencyCode: z.string().trim().min(1).max(3).default("USD"),
  countryOfOriginCode: z.string().trim().max(3).optional().nullable(),
  declaredNetWeightKg: z.string().trim().optional().nullable(),
  declaredGrossWeightKg: z.string().trim().optional().nullable(),
});

export const updateInvoiceLineSchema = createInvoiceLineSchema
  .omit({ documentId: true })
  .partial()
  .extend({
    isReviewed: z.boolean().optional(),
  });

export const createPackingListLineSchema = z.object({
  documentId: z.string().uuid(),
  lineNumber: z.number().int().min(1).optional(),
  supplierDescription: z.string().trim().min(1).max(5000),
  supplierSku: z.string().trim().max(100).optional().nullable(),
  brand: z.string().trim().max(100).optional().nullable(),
  modelNumber: z.string().trim().max(100).optional().nullable(),
  quantity: z.string().trim().min(1),
  unitOfMeasure: z.string().trim().min(1).max(30),
  packageType: z.string().trim().max(50).optional().nullable(),
  numberOfPackages: z.string().trim().optional().nullable(),
  piecesPerPackage: z.string().trim().optional().nullable(),
  netWeightKg: z.string().trim().optional().nullable(),
  grossWeightKg: z.string().trim().optional().nullable(),
  lengthCm: z.string().trim().optional().nullable(),
  widthCm: z.string().trim().optional().nullable(),
  heightCm: z.string().trim().optional().nullable(),
  packageMarks: z.string().trim().max(500).optional().nullable(),
  countryOfOriginCode: z.string().trim().max(3).optional().nullable(),
});

export const updatePackingListLineSchema = createPackingListLineSchema
  .omit({ documentId: true })
  .partial()
  .extend({
    isReviewed: z.boolean().optional(),
  });

export type CreateImportCaseInput = z.infer<typeof createImportCaseSchema>;
export type UpdateImportCaseInput = z.infer<typeof updateImportCaseSchema>;
export type CreateInvoiceLineInput = z.infer<typeof createInvoiceLineSchema>;
export type UpdateInvoiceLineInput = z.infer<typeof updateInvoiceLineSchema>;
export type CreatePackingListLineInput = z.infer<
  typeof createPackingListLineSchema
>;
export type UpdatePackingListLineInput = z.infer<
  typeof updatePackingListLineSchema
>;

export const updateProductSchema = z.object({
  normalizedDescription: z.string().trim().min(1).max(5000).optional(),
  productName: z.string().trim().max(255).optional().nullable(),
  brand: z.string().trim().max(100).optional().nullable(),
  modelNumber: z.string().trim().max(100).optional().nullable(),
  material: z.string().trim().max(255).optional().nullable(),
  intendedUse: z.string().trim().max(2000).optional().nullable(),
  quantity: z.string().trim().optional().nullable(),
  unitOfMeasure: z.string().trim().max(30).optional().nullable(),
  countryOfOriginCode: z.string().trim().max(3).optional().nullable(),
  status: z
    .enum([
      "draft",
      "needs_information",
      "ready_for_hs_suggestion",
      "hs_suggested",
      "needs_expert_review",
      "classified",
      "approved_for_declaration",
      "rejected",
    ])
    .optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const approveClassificationSchema = z
  .object({
    candidateId: z.string().uuid().optional(),
    hsCode: z.string().trim().min(1).max(20).optional(),
    officialDescription: z.string().trim().max(5000).optional(),
    reviewerReason: z.string().trim().max(2000).optional(),
  })
  .refine((data) => data.candidateId || data.hsCode, {
    message: "Either candidateId or hsCode is required",
  });

export type ApproveClassificationInput = z.infer<
  typeof approveClassificationSchema
>;

export const bulkReviewSchema = z.object({
  action: z.enum(["approve", "override", "reject"]),
  reason: z.string().trim().max(2000).optional().nullable(),
  overrideHsCode: z.string().trim().max(20).optional().nullable(),
});

export type BulkReviewInput = z.infer<typeof bulkReviewSchema>;
