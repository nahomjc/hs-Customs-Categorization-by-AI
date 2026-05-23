import { db } from "@/db";
import { documents, documentItems } from "@/db/schema";
import { extractTextFromBuffer, type FileType } from "./extractText";
import { parseLines } from "./parseLines";
import { eq } from "drizzle-orm";

/** Extract text and insert line items only (classification runs in batches). */
export async function parseDocumentFromBuffer(
  documentId: string,
  buffer: Buffer,
  fileType: FileType
): Promise<{ itemCount: number }> {
  const extractedText = await extractTextFromBuffer(buffer, fileType);

  await db
    .update(documents)
    .set({
      extractedText,
      status: "parsed",
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));

  const parsed = parseLines(extractedText);

  await db
    .delete(documentItems)
    .where(eq(documentItems.documentId, documentId));
  for (const p of parsed) {
    const quantity =
      p.quantity != null && !Number.isNaN(p.quantity)
        ? Math.floor(Number(p.quantity))
        : null;
    await db.insert(documentItems).values({
      documentId,
      rawLine: p.rawLine,
      detectedDescription: p.description,
      detectedQuantity: quantity,
      detectedUnit: p.unit,
      lineIndex: p.lineIndex,
    });
  }

  return { itemCount: parsed.length };
}
