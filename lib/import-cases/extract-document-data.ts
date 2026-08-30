import { z } from "zod";
import type { DocumentType } from "./constants";
import {
  AI_MODEL_NAME,
  invoiceExtractSchema,
  packingListExtractSchema,
  PROMPT_VERSION,
  type InvoiceExtractResult,
  type PackingListExtractResult,
} from "./extraction-schemas";

export type ExtractDocumentInput = {
  documentType: DocumentType;
  ocrText: string;
  fileName: string;
};

export type ExtractDocumentOutput = {
  kind: "invoice" | "packing_list" | "other";
  data: InvoiceExtractResult | PackingListExtractResult | Record<string, unknown>;
  confidence: number;
  missingFields: string[];
  aiModelName: string;
  promptVersion: string;
  rawResponse: string;
};

function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : content.trim();
  return JSON.parse(raw) as unknown;
}

const INVOICE_SYSTEM = `You extract structured data from commercial invoices for Ethiopian import clearance.
This is decision support only — not a final customs determination.
Return ONLY valid JSON with this shape:
{
  "documentNumber": "string or null",
  "documentDate": "ISO date string or null",
  "supplierName": "string or null",
  "buyerName": "string or null",
  "currencyCode": "3-letter code or null",
  "invoiceTotalAmount": "string number or null",
  "incoterm": "string or null",
  "countryOfOriginCode": "ISO 2-letter or null",
  "lines": [{
    "lineNumber": 1,
    "supplierDescription": "original text",
    "supplierSku": "string or null",
    "brand": "string or null",
    "modelNumber": "string or null",
    "quantity": "string",
    "unitOfMeasure": "string",
    "unitPrice": "string or null",
    "lineTotalAmount": "string or null",
    "currencyCode": "string or null",
    "countryOfOriginCode": "string or null"
  }],
  "confidence": 0.0-1.0,
  "missingFields": ["field names still unclear"]
}
Preserve original supplier wording in supplierDescription. Extract every product line.`;

const PACKING_SYSTEM = `You extract structured data from packing lists for Ethiopian import clearance.
This is decision support only — not a final customs determination.
Return ONLY valid JSON with this shape:
{
  "documentNumber": "string or null",
  "documentDate": "ISO date string or null",
  "relatedInvoiceNumber": "string or null",
  "supplierName": "string or null",
  "shipmentReference": "string or null",
  "lines": [{
    "lineNumber": 1,
    "supplierDescription": "original text",
    "supplierSku": "string or null",
    "brand": "string or null",
    "modelNumber": "string or null",
    "quantity": "string",
    "unitOfMeasure": "string",
    "packageType": "string or null",
    "numberOfPackages": "string or null",
    "piecesPerPackage": "string or null",
    "netWeightKg": "string or null",
    "grossWeightKg": "string or null",
    "packageMarks": "string or null",
    "countryOfOriginCode": "string or null"
  }],
  "confidence": 0.0-1.0,
  "missingFields": ["field names still unclear"]
}
Preserve original supplier wording in supplierDescription. Extract every product line.`;

async function callExtractionAi(
  system: string,
  userContent: string,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3010",
    },
    body: JSON.stringify({
      model: AI_MODEL_NAME,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI extraction failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("AI returned empty extraction response");
  return content;
}

function isInvoiceType(documentType: DocumentType): boolean {
  return (
    documentType === "commercial_invoice" ||
    documentType === "proforma_invoice"
  );
}

function isPackingListType(documentType: DocumentType): boolean {
  return documentType === "packing_list";
}

/** Rule-based CSV parser for test/simple structured files */
function tryParseCsvInvoice(text: string): InvoiceExtractResult | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex((l) =>
    /^line,/i.test(l) || l.toLowerCase().startsWith("line,description"),
  );
  if (headerIdx < 0) return null;

  const meta: Record<string, string> = {};
  for (let i = 0; i < headerIdx; i++) {
    const parts = lines[i].split(",");
    if (parts.length >= 2) {
      meta[parts[0].trim().toLowerCase()] = parts.slice(1).join(",").trim();
    }
  }

  const productLines = lines.slice(headerIdx + 1).filter((l) => /^\d+,/.test(l));
  if (productLines.length === 0) return null;

  const parsedLines = productLines.map((row, idx) => {
    const cols = row.split(",");
    return {
      lineNumber: Number(cols[0]) || idx + 1,
      supplierDescription: cols[1]?.trim() ?? "",
      supplierSku: cols[2]?.trim() || null,
      brand: cols[3]?.trim() || null,
      modelNumber: cols[4]?.trim() || null,
      quantity: cols[5]?.trim() ?? "0",
      unitOfMeasure: cols[6]?.trim() ?? "pcs",
      unitPrice: cols[7]?.trim() || null,
      lineTotalAmount: cols[8]?.trim() || null,
      currencyCode: meta.currency || meta["invoice currency"] || "USD",
    };
  });

  return invoiceExtractSchema.parse({
    documentNumber: meta["invoice number"] ?? null,
    documentDate: meta["invoice date"] ?? null,
    supplierName: meta["supplier name"] ?? null,
    buyerName: meta["buyer / importer"] ?? meta["buyer"] ?? null,
    currencyCode: meta.currency ?? null,
    incoterm: meta.incoterm ?? null,
    countryOfOriginCode: meta["country of origin"] ?? null,
    lines: parsedLines,
    confidence: 0.85,
    missingFields: [],
  });
}

function tryParseCsvPackingList(text: string): PackingListExtractResult | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex((l) =>
    /^line,/i.test(l) || l.toLowerCase().includes("net weight"),
  );
  if (headerIdx < 0) return null;

  const meta: Record<string, string> = {};
  for (let i = 0; i < headerIdx; i++) {
    const parts = lines[i].split(",");
    if (parts.length >= 2) {
      meta[parts[0].trim().toLowerCase()] = parts.slice(1).join(",").trim();
    }
  }

  const productLines = lines
    .slice(headerIdx + 1)
    .filter((l) => /^\d+,/.test(l) && !/^total/i.test(l));
  if (productLines.length === 0) return null;

  const parsedLines = productLines.map((row, idx) => {
    const cols = row.split(",");
    return {
      lineNumber: Number(cols[0]) || idx + 1,
      supplierDescription: cols[1]?.trim() ?? "",
      supplierSku: cols[2]?.trim() || null,
      quantity: cols[3]?.trim() ?? "0",
      unitOfMeasure: cols[4]?.trim() ?? "pcs",
      numberOfPackages: cols[5]?.trim() || null,
      packageType: cols[6]?.trim() || null,
      piecesPerPackage: cols[7]?.trim() || null,
      netWeightKg: cols[8]?.trim() || null,
      grossWeightKg: cols[9]?.trim() || null,
      packageMarks: cols[10]?.trim() || null,
      countryOfOriginCode: cols[11]?.trim() || null,
    };
  });

  return packingListExtractSchema.parse({
    documentNumber: meta["packing list number"] ?? null,
    relatedInvoiceNumber: meta["related invoice number"] ?? null,
    documentDate: meta["packing list date"] ?? null,
    supplierName: meta["supplier name"] ?? null,
    shipmentReference: meta["shipment reference"] ?? null,
    lines: parsedLines,
    confidence: 0.85,
    missingFields: [],
  });
}

export async function extractDocumentData(
  input: ExtractDocumentInput,
): Promise<ExtractDocumentOutput> {
  const { documentType, ocrText, fileName } = input;
  const isCsv = fileName.toLowerCase().endsWith(".csv");

  if (isInvoiceType(documentType)) {
    if (isCsv) {
      const csvResult = tryParseCsvInvoice(ocrText);
      if (csvResult) {
        return {
          kind: "invoice",
          data: csvResult,
          confidence: csvResult.confidence ?? 0.85,
          missingFields: csvResult.missingFields ?? [],
          aiModelName: "csv-parser",
          promptVersion: PROMPT_VERSION,
          rawResponse: JSON.stringify(csvResult),
        };
      }
    }

    const raw = await callExtractionAi(
      INVOICE_SYSTEM,
      `File: ${fileName}\nDocument type: ${documentType}\n\n${ocrText}`,
    );
    const parsed = invoiceExtractSchema.parse(extractJson(raw));
    return {
      kind: "invoice",
      data: parsed,
      confidence: parsed.confidence ?? 0.7,
      missingFields: parsed.missingFields ?? [],
      aiModelName: AI_MODEL_NAME,
      promptVersion: PROMPT_VERSION,
      rawResponse: raw,
    };
  }

  if (isPackingListType(documentType)) {
    if (isCsv) {
      const csvResult = tryParseCsvPackingList(ocrText);
      if (csvResult) {
        return {
          kind: "packing_list",
          data: csvResult,
          confidence: csvResult.confidence ?? 0.85,
          missingFields: csvResult.missingFields ?? [],
          aiModelName: "csv-parser",
          promptVersion: PROMPT_VERSION,
          rawResponse: JSON.stringify(csvResult),
        };
      }
    }

    const raw = await callExtractionAi(
      PACKING_SYSTEM,
      `File: ${fileName}\nDocument type: ${documentType}\n\n${ocrText}`,
    );
    const parsed = packingListExtractSchema.parse(extractJson(raw));
    return {
      kind: "packing_list",
      data: parsed,
      confidence: parsed.confidence ?? 0.7,
      missingFields: parsed.missingFields ?? [],
      aiModelName: AI_MODEL_NAME,
      promptVersion: PROMPT_VERSION,
      rawResponse: raw,
    };
  }

  return {
    kind: "other",
    data: { textLength: ocrText.length },
    confidence: 0,
    missingFields: ["unsupported_document_type_for_line_extraction"],
    aiModelName: AI_MODEL_NAME,
    promptVersion: PROMPT_VERSION,
    rawResponse: "",
  };
}
