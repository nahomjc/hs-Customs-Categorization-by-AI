"use server";

import { db } from "@/db";
import {
  documents,
  documentItems,
  itemClassifications,
  groupedItems,
} from "@/db/schema";
import { extractTextFromBuffer, type FileType } from "./extractText";
import { parseLines } from "./parseLines";
import { classifyItem } from "./classifyItem";
import { validateClassification } from "./allowedHsCodes";
import { classifyByRulesOnly } from "./assessorRules";
import { groupItemsByHsCode, type ItemWithClassification } from "./groupItems";
import { eq } from "drizzle-orm";

export async function processDocumentPipeline(
  documentId: string,
  buffer: Buffer,
  fileType: FileType,
  onStatus?: (status: string) => void
) {
  onStatus?.("Reading document");
  const extractedText = await extractTextFromBuffer(buffer, fileType);

  await db
    .update(documents)
    .set({
      extractedText,
      status: "parsed",
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));

  onStatus?.("Extracting items");
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

  const items = await db
    .select()
    .from(documentItems)
    .where(eq(documentItems.documentId, documentId))
    .orderBy(documentItems.lineIndex);

  onStatus?.("AI classifying items");
  await db
    .update(documents)
    .set({ status: "ai_processed", updatedAt: new Date() })
    .where(eq(documents.id, documentId));

  for (const item of items) {
    try {
      const result = await classifyItem(
        item.detectedDescription || item.rawLine,
        {
          unit: item.detectedUnit ?? undefined,
        }
      );
      // Result is already validated in classifyItem (exact HS, category gate)
      const hsCode = result.isImportItem === false ? "EXCLUDE" : result.hsCode;
      await db.insert(itemClassifications).values({
        itemId: item.id,
        aiCategory: result.category,
        aiHsCode: hsCode,
        cleanDescription: result.cleanDescription,
        confidence: String(result.confidence ?? 0.9),
        aiRawResponse: result.aiRawResponse,
      });
    } catch (e) {
      try {
        // API failed: use rule-based classification, then validate (exact HS only)
        const desc = item.detectedDescription ?? item.rawLine ?? "";
        const ruleResult = classifyByRulesOnly(desc);
        const validated = validateClassification({
          hsCode: ruleResult.hsCode,
          category: ruleResult.category,
        });
        await db.insert(itemClassifications).values({
          itemId: item.id,
          aiCategory: ruleResult.category,
          aiHsCode: validated.hsCode,
          cleanDescription: ruleResult.cleanDescription,
          confidence: "0.8",
          aiRawResponse: String(
            e instanceof Error ? e.message : e ?? "Unknown error"
          ),
        });
      } catch (insertErr) {
        console.error(
          "[processDocument] fallback insert failed",
          item.id,
          insertErr
        );
      }
    }
  }

  const itemsWithClassification = await db
    .select({
      id: documentItems.id,
      rawLine: documentItems.rawLine,
      detectedDescription: documentItems.detectedDescription,
      detectedQuantity: documentItems.detectedQuantity,
      detectedUnit: documentItems.detectedUnit,
      aiCategory: itemClassifications.aiCategory,
      aiHsCode: itemClassifications.aiHsCode,
      cleanDescription: itemClassifications.cleanDescription,
    })
    .from(documentItems)
    .leftJoin(
      itemClassifications,
      eq(documentItems.id, itemClassifications.itemId)
    )
    .where(eq(documentItems.documentId, documentId))
    .orderBy(documentItems.lineIndex);

  onStatus?.("Grouping by HS code");
  const grouped = groupItemsByHsCode(
    itemsWithClassification as unknown as ItemWithClassification[]
  );

  await db.delete(groupedItems).where(eq(groupedItems.documentId, documentId));
  for (const g of grouped) {
    await db.insert(groupedItems).values({
      documentId,
      hsCode: g.hsCode,
      category: g.category,
      finalDescription: g.finalDescription,
      totalQuantity: g.totalQuantity,
      unit: g.unit,
    });
  }

  await db
    .update(documents)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(documents.id, documentId));

  return { success: true };
}
