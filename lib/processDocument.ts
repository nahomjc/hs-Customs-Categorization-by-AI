import { db } from "@/db";
import { documents, documentItems } from "@/db/schema";
import { extractTextFromBuffer, type FileType } from "./extractText";
import {
  detectClassificationMode,
  parsePackingListFromText,
} from "./parsePackingListTable";
import { normalizeLineQuantity } from "./packingListFilters";
import { loadHsReferenceCache } from "./hsReference";
import {
  enrichParsedRowFromReference,
  isReferencePopulated,
} from "./hsReferenceCache";
import { countHsCodesInText, preprocessPackingListOcr } from "./hsCodeUtils";
import { eq } from "drizzle-orm";

/** Minimum dotted HS codes in source text to treat document as pre-coded for reference enrichment. */
const MIN_DOCUMENT_HS_CODES_FOR_ENRICHMENT = 3;

/** Extract text and insert line items only (classification runs in batches). */
export async function parseDocumentFromBuffer(
  documentId: string,
  buffer: Buffer,
  fileType: FileType,
  options?: { classificationModeOverride?: "ai" | "pre_coded" },
): Promise<{ itemCount: number; classificationMode: string }> {
  const extractedText = await extractTextFromBuffer(buffer, fileType);
  const parsed = parsePackingListFromText(extractedText);
  const preprocessed = preprocessPackingListOcr(extractedText);
  const hsCodesInDocument = countHsCodesInText(preprocessed);

  await loadHsReferenceCache();

  let rows = parsed.rows;
  let mode = options?.classificationModeOverride ?? parsed.mode;
  let referenceEnriched = 0;

  const canEnrichFromReference =
    isReferencePopulated() &&
    hsCodesInDocument >= MIN_DOCUMENT_HS_CODES_FOR_ENRICHMENT;

  if (canEnrichFromReference) {
    const enrichedRows = rows.map((row) => {
      const enriched = enrichParsedRowFromReference(row);
      if (!row.sourceHsCode && enriched.sourceHsCode) referenceEnriched++;
      return enriched;
    });
    rows = enrichedRows;

    if (!options?.classificationModeOverride) {
      mode = detectClassificationMode(enrichedRows, hsCodesInDocument);
    }
  }

  const started = Date.now();

  await db
    .update(documents)
    .set({
      extractedText,
      classificationMode: mode,
      status: "parsed",
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));
  const itemValues = rows.map((p) => ({
    documentId,
    rawLine: p.rawLine,
    detectedDescription: p.description,
    detectedQuantity: normalizeLineQuantity(p.quantity),
    detectedUnit: p.unit,
    sourceHsCode: p.sourceHsCode,
    lineNumber: p.lineNumber,
    specification: p.specification,
    lineIndex: p.lineIndex,
  }));

  await db.transaction(async (tx) => {
    await tx
      .delete(documentItems)
      .where(eq(documentItems.documentId, documentId));

    const chunkSize = 100;
    for (let i = 0; i < itemValues.length; i += chunkSize) {
      const chunk = itemValues.slice(i, i + chunkSize);
      if (chunk.length > 0) {
        await tx.insert(documentItems).values(chunk);
      }
    }
  });

  console.log(
    `[parseDocument] ${documentId} | mode=${mode} | items=${rows.length} | docHs=${hsCodesInDocument} | referenceEnriched=${referenceEnriched} | db=${Date.now() - started}ms`,
  );

  return { itemCount: rows.length, classificationMode: mode };
}
