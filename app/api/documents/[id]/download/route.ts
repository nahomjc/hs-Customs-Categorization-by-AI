import { db } from "@/db";
import { documentItems, groupedItems, itemClassifications } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  buildLineItemExportRows,
  generateCategorizedExcel,
} from "@/lib/generateExcel";
import { generateCategorizedCsv } from "@/lib/generateCsv";
import { getUserPreferences } from "@/lib/settings/user-settings";
import { eq } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const formatParam = searchParams.get("format");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let format: "xlsx" | "csv" = "xlsx";
  if (formatParam === "csv" || formatParam === "xlsx") {
    format = formatParam;
  } else if (user?.id) {
    const prefs = await getUserPreferences(user.id);
    format = prefs.defaultExportFormat;
  }

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

  if (format === "csv") {
    const buffer = generateCategorizedCsv(grouped, { lineItems });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          "attachment; filename=categorized-packing-list.csv",
      },
    });
  }

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
