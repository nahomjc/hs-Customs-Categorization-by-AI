import { db } from "@/db";
import {
  documentItems,
  documents,
  groupedItems,
  itemClassifications,
} from "@/db/schema";
import { classifyItem } from "./classifyItem";
import { validateClassification } from "./allowedHsCodes";
import { classifyByRulesOnly } from "./assessorRules";
import { groupItemsByHsCode, type ItemWithClassification } from "./groupItems";
import { and, eq, isNull, sql } from "drizzle-orm";

export const CLASSIFY_BATCH_SIZE = 6;
export const CLASSIFY_CONCURRENCY = 3;

type ItemRow = typeof documentItems.$inferSelect;

async function countClassified(documentId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(itemClassifications)
    .innerJoin(
      documentItems,
      eq(documentItems.id, itemClassifications.itemId)
    )
    .where(eq(documentItems.documentId, documentId));
  return Number(row?.count ?? 0);
}

async function countTotalItems(documentId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documentItems)
    .where(eq(documentItems.documentId, documentId));
  return Number(row?.count ?? 0);
}

async function classifyOneItem(item: ItemRow): Promise<void> {
  const [existing] = await db
    .select({ id: itemClassifications.id })
    .from(itemClassifications)
    .where(eq(itemClassifications.itemId, item.id))
    .limit(1);
  if (existing) return;

  const desc = item.detectedDescription || item.rawLine || "";
  try {
    const result = await classifyItem(desc, {
      unit: item.detectedUnit ?? undefined,
    });
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
  }
}

async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number
): Promise<void> {
  let index = 0;
  const runWorker = async () => {
    while (index < items.length) {
      const i = index++;
      const item = items[i];
      if (item !== undefined) await worker(item);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () =>
      runWorker()
    )
  );
}

export async function finalizeDocumentGrouping(
  documentId: string
): Promise<void> {
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
}

export async function classifyDocumentBatch(documentId: string): Promise<{
  completed: boolean;
  totalItems: number;
  classifiedCount: number;
  error?: string;
}> {
  const totalItems = await countTotalItems(documentId);

  if (totalItems === 0) {
    await db
      .update(documents)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(documents.id, documentId));
    return {
      completed: false,
      totalItems: 0,
      classifiedCount: 0,
      error: "No line items found in document",
    };
  }

  const pendingRows = await db
    .select({ item: documentItems })
    .from(documentItems)
    .leftJoin(
      itemClassifications,
      eq(documentItems.id, itemClassifications.itemId)
    )
    .where(
      and(
        eq(documentItems.documentId, documentId),
        isNull(itemClassifications.id)
      )
    )
    .orderBy(documentItems.lineIndex)
    .limit(CLASSIFY_BATCH_SIZE);

  const pending = pendingRows.map((r) => r.item);

  if (pending.length === 0) {
    await finalizeDocumentGrouping(documentId);
    return { completed: true, totalItems, classifiedCount: totalItems };
  }

  await db
    .update(documents)
    .set({ status: "ai_processed", updatedAt: new Date() })
    .where(eq(documents.id, documentId));

  console.log(
    `[classifyDocumentBatch] ${documentId} | classifying ${pending.length} items | total ${totalItems}`
  );

  await runWithConcurrency(pending, classifyOneItem, CLASSIFY_CONCURRENCY);

  const classifiedCount = await countClassified(documentId);
  const remaining = totalItems - classifiedCount;

  if (remaining <= 0) {
    await finalizeDocumentGrouping(documentId);
    return { completed: true, totalItems, classifiedCount: totalItems };
  }

  return {
    completed: false,
    totalItems,
    classifiedCount,
  };
}
