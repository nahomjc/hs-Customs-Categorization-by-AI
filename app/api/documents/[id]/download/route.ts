import { db } from "@/db";
import { documentItems, groupedItems, itemClassifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  buildLineItemExportRows,
  generateCategorizedExcel,
} from "@/lib/generateExcel";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rows = await db
    .select()
    .from(groupedItems)
    .where(eq(groupedItems.documentId, id));
  const grouped = rows.map((r) => ({
    hsCode: r.hsCode,
    category: r.category,
    finalDescription: r.finalDescription,
    totalQuantity: r.totalQuantity,
    unit: r.unit,
  }));

  const items = await db
    .select({
      lineNumber: documentItems.lineNumber,
      detectedDescription: documentItems.detectedDescription,
      rawLine: documentItems.rawLine,
      sourceHsCode: documentItems.sourceHsCode,
      detectedQuantity: documentItems.detectedQuantity,
      detectedUnit: documentItems.detectedUnit,
      specification: documentItems.specification,
      aiHsCode: itemClassifications.aiHsCode,
      aiCategory: itemClassifications.aiCategory,
      aiRawResponse: itemClassifications.aiRawResponse,
    })
    .from(documentItems)
    .leftJoin(
      itemClassifications,
      eq(documentItems.id, itemClassifications.itemId)
    )
    .where(eq(documentItems.documentId, id))
    .orderBy(documentItems.lineIndex);

  const lineItems = buildLineItemExportRows(items);

  const buffer = await generateCategorizedExcel(grouped, { lineItems });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        "attachment; filename=categorized-packing-list.xlsx",
    },
  });
}
