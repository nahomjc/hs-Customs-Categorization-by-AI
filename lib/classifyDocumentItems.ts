import { db } from "@/db";
import {
  documentItems,
  documents,
  groupedItems,
  itemClassifications,
} from "@/db/schema";
import { classifyItem } from "./classifyItem";
import { classifyFromDocumentHs } from "./classifyFromDocumentHs";
import { EXCLUDED_HS, validateClassification } from "./allowedHsCodes";
import { classifyByRulesOnly } from "./assessorRules";
import { cleanProductDescription, isNonItemLine } from "./packingListFilters";
import { isPlausibleHsCode } from "./hsCodeUtils";
import { groupItemsByHsCode, type ItemWithClassification } from "./groupItems";
import { and, eq, isNull, sql } from "drizzle-orm";

export const CLASSIFY_BATCH_SIZE = 20;
export const PRE_CODED_BATCH_SIZE = 60;
export const CLASSIFY_CONCURRENCY = 6;

type ItemRow = typeof documentItems.$inferSelect;
type ClassificationInsert = typeof itemClassifications.$inferInsert;

async function getDocumentMode(
  documentId: string,
): Promise<"ai" | "pre_coded"> {
  const [doc] = await db
    .select({ classificationMode: documents.classificationMode })
    .from(documents)
    .where(eq(documents.id, documentId));
  return doc?.classificationMode === "pre_coded" ? "pre_coded" : "ai";
}

async function countClassified(documentId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(itemClassifications)
    .innerJoin(documentItems, eq(documentItems.id, itemClassifications.itemId))
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

function buildPreCodedClassification(item: ItemRow): ClassificationInsert {
  const desc = cleanProductDescription(
    item.detectedDescription || item.rawLine || "",
  );

  if (isNonItemLine(desc, item.rawLine)) {
    return {
      itemId: item.id,
      aiCategory: "Non-item",
      aiHsCode: EXCLUDED_HS,
      cleanDescription: desc.slice(0, 200),
      confidence: "1",
      aiRawResponse: JSON.stringify({ source: "filter", reason: "metadata" }),
    };
  }

  const useDocumentHs =
    item.sourceHsCode?.trim() && isPlausibleHsCode(item.sourceHsCode);

  if (useDocumentHs) {
    const result = classifyFromDocumentHs(desc, item.sourceHsCode ?? "", {
      unit: item.detectedUnit ?? undefined,
    });
    const validated = validateClassification({
      hsCode: result.hsCode,
      category: result.category,
      mode: "document",
    });
    return {
      itemId: item.id,
      aiCategory: result.category,
      aiHsCode: validated.hsCode,
      cleanDescription: result.cleanDescription,
      confidence: String(result.confidence ?? 0.98),
      aiRawResponse: result.aiRawResponse,
    };
  }

  return {
    itemId: item.id,
    aiCategory: "Need review",
    aiHsCode: "NEED_INFO",
    cleanDescription: desc,
    confidence: "0.5",
    aiRawResponse: JSON.stringify({
      source: "pre_coded",
      reason: "missing_document_hs",
    }),
  };
}

async function classifyPreCodedBatch(items: ItemRow[]): Promise<void> {
  const rows = items.map(buildPreCodedClassification);
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (chunk.length > 0) {
      await db.insert(itemClassifications).values(chunk);
    }
  }
}

async function classifyOneItem(item: ItemRow): Promise<void> {
  const desc = cleanProductDescription(
    item.detectedDescription || item.rawLine || "",
  );

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
      mode: "ai",
    });
    await db.insert(itemClassifications).values({
      itemId: item.id,
      aiCategory: ruleResult.category,
      aiHsCode: validated.hsCode,
      cleanDescription: ruleResult.cleanDescription,
      confidence: "0.8",
      aiRawResponse: String(
        e instanceof Error ? e.message : (e ?? "Unknown error"),
      ),
    });
  }
}

async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
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
      runWorker(),
    ),
  );
}

export async function finalizeDocumentGrouping(
  documentId: string,
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
      eq(documentItems.id, itemClassifications.itemId),
    )
    .where(eq(documentItems.documentId, documentId))
    .orderBy(documentItems.lineIndex);

  const grouped = groupItemsByHsCode(
    itemsWithClassification as unknown as ItemWithClassification[],
  );

  await db.delete(groupedItems).where(eq(groupedItems.documentId, documentId));

  if (grouped.length > 0) {
    await db.insert(groupedItems).values(
      grouped.map((g) => ({
        documentId,
        hsCode: g.hsCode,
        category: g.category,
        finalDescription: g.finalDescription,
        totalQuantity: g.totalQuantity,
        unit: g.unit,
      })),
    );
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
  const docMode = await getDocumentMode(documentId);

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
      eq(documentItems.id, itemClassifications.itemId),
    )
    .where(
      and(
        eq(documentItems.documentId, documentId),
        isNull(itemClassifications.id),
      ),
    )
    .orderBy(documentItems.lineIndex)
    .limit(
      docMode === "pre_coded" ? PRE_CODED_BATCH_SIZE : CLASSIFY_BATCH_SIZE,
    );

  const pending = pendingRows.map((r) => r.item);

  if (pending.length === 0) {
    await finalizeDocumentGrouping(documentId);
    return { completed: true, totalItems, classifiedCount: totalItems };
  }

  await db
    .update(documents)
    .set({ status: "ai_processed", updatedAt: new Date() })
    .where(eq(documents.id, documentId));

  const batchStarted = Date.now();
  console.log(
    `[classifyDocumentBatch] ${documentId} | mode=${docMode} | batch=${pending.length}/${totalItems}`,
  );

  if (docMode === "pre_coded") {
    await classifyPreCodedBatch(pending);
  } else {
    await runWithConcurrency(
      pending,
      (item) => classifyOneItem(item),
      CLASSIFY_CONCURRENCY,
    );
  }

  console.log(
    `[classifyDocumentBatch] ${documentId} | batch done ${Date.now() - batchStarted}ms`,
  );

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
