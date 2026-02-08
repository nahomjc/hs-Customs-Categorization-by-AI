import { db } from "@/db";
import { documents, documentItems, itemClassifications } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [doc] = await db
    .select({ status: documents.status })
    .from(documents)
    .where(eq(documents.id, id));
  if (!doc) return Response.json({ status: null });

  const status = doc.status ?? null;
  let totalItems = 0;
  let classifiedCount = 0;

  if (status === "ai_processed" || status === "parsed") {
    const [itemsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(documentItems)
      .where(eq(documentItems.documentId, id));
    totalItems = Number(itemsRow?.count ?? 0);

    const [doneRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(itemClassifications)
      .innerJoin(
        documentItems,
        eq(documentItems.id, itemClassifications.itemId)
      )
      .where(eq(documentItems.documentId, id));
    classifiedCount = Number(doneRow?.count ?? 0);
  }

  return Response.json({
    status,
    ...(totalItems > 0 && { totalItems, classifiedCount }),
  });
}
