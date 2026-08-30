import { z } from "zod";

const numericString = z.union([z.string(), z.number()]).transform(String);

export const invoiceLineExtractSchema = z.object({
  lineNumber: z.number().int().positive().optional(),
  supplierDescription: z.string().min(1),
  supplierSku: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  modelNumber: z.string().nullable().optional(),
  quantity: numericString,
  unitOfMeasure: z.string().min(1),
  unitPrice: numericString.nullable().optional(),
  lineTotalAmount: numericString.nullable().optional(),
  currencyCode: z.string().optional(),
  countryOfOriginCode: z.string().nullable().optional(),
});

export const invoiceExtractSchema = z.object({
  documentNumber: z.string().nullable().optional(),
  documentDate: z.string().nullable().optional(),
  supplierName: z.string().nullable().optional(),
  buyerName: z.string().nullable().optional(),
  currencyCode: z.string().nullable().optional(),
  invoiceTotalAmount: numericString.nullable().optional(),
  incoterm: z.string().nullable().optional(),
  countryOfOriginCode: z.string().nullable().optional(),
  lines: z.array(invoiceLineExtractSchema).min(1),
  confidence: z.number().min(0).max(1).optional(),
  missingFields: z.array(z.string()).optional(),
});

export const packingListLineExtractSchema = z.object({
  lineNumber: z.number().int().positive().optional(),
  supplierDescription: z.string().min(1),
  supplierSku: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  modelNumber: z.string().nullable().optional(),
  quantity: numericString,
  unitOfMeasure: z.string().min(1),
  packageType: z.string().nullable().optional(),
  numberOfPackages: numericString.nullable().optional(),
  piecesPerPackage: numericString.nullable().optional(),
  netWeightKg: numericString.nullable().optional(),
  grossWeightKg: numericString.nullable().optional(),
  packageMarks: z.string().nullable().optional(),
  countryOfOriginCode: z.string().nullable().optional(),
});

export const packingListExtractSchema = z.object({
  documentNumber: z.string().nullable().optional(),
  documentDate: z.string().nullable().optional(),
  relatedInvoiceNumber: z.string().nullable().optional(),
  supplierName: z.string().nullable().optional(),
  shipmentReference: z.string().nullable().optional(),
  lines: z.array(packingListLineExtractSchema).min(1),
  confidence: z.number().min(0).max(1).optional(),
  missingFields: z.array(z.string()).optional(),
});

export type InvoiceExtractResult = z.infer<typeof invoiceExtractSchema>;
export type PackingListExtractResult = z.infer<typeof packingListExtractSchema>;

export const PROMPT_VERSION = "import-doc-extract-v1";
export const AI_MODEL_NAME = "openai/gpt-4o-mini";
