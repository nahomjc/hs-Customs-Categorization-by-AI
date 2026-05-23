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
  fileType: FileType
): Promise<{ itemCount: number; classificationMode: string }> {
  const extractedText = await extractTextFromBuffer(buffer, fileType);
  const { rows, mode } = parsePackingListFromText(extractedText);

  await db
    .update(documents)
    .set({
      extractedText,
      classificationMode: mode,
      status: "parsed",
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));

  await db
    .delete(documentItems)
    .where(eq(documentItems.documentId, documentId));

  for (const p of rows) {
    const quantity = normalizeLineQuantity(p.quantity);
    await db.insert(documentItems).values({
      documentId,
      rawLine: p.rawLine,
      detectedDescription: p.description,
      detectedQuantity: quantity,
      detectedUnit: p.unit,
      sourceHsCode: p.sourceHsCode,
      lineNumber: p.lineNumber,
      specification: p.specification,
      lineIndex: p.lineIndex,
    });
  }

  console.log(
    `[parseDocument] ${documentId} | mode=${mode} | items=${rows.length}`
  );

  return { itemCount: rows.length, classificationMode: mode };
}
