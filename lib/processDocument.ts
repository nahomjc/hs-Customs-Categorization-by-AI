import { db } from "@/db";
import { documents, documentItems } from "@/db/schema";
import { extractTextFromBuffer, type FileType } from "./extractText";
import { parsePackingListFromText } from "./parsePackingListTable";
import { normalizeLineQuantity } from "./packingListFilters";
import { eq } from "drizzle-orm";

/** Extract text and insert line items only (classification runs in batches). */
export async function parseDocumentFromBuffer(
  documentId: string,
  buffer: Buffer,
  fileType: FileType,
  options?: { classificationModeOverride?: "ai" | "pre_coded" }
): Promise<{ itemCount: number; classificationMode: string }> {
  const extractedText = await extractTextFromBuffer(buffer, fileType);
  const parsed = parsePackingListFromText(extractedText);
  const mode =
    options?.classificationModeOverride ?? parsed.mode;
  const rows = parsed.rows;

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
    `[parseDocument] ${documentId} | mode=${mode} | items=${rows.length} | db=${Date.now() - started}ms`
  );

  return { itemCount: rows.length, classificationMode: mode };
}
