import { db } from "@/db";
import { groupedItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateCategorizedExcel } from "@/lib/generateExcel";

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
  const buffer = await generateCategorizedExcel(grouped);
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        "attachment; filename=categorized-packing-list.xlsx",
    },
  });
}
