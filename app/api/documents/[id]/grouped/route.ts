import { db } from "@/db";
import { groupedItems } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  let body: {
    id?: string;
    hsCode?: string;
    category?: string;
    finalDescription?: string;
    totalQuantity?: number;
    unit?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const groupedId = body.id;
  if (!groupedId || typeof groupedId !== "string") {
    return Response.json(
      { error: "Grouped item id is required" },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.hsCode === "string" && body.hsCode.trim())
    updates.hsCode = body.hsCode.trim().slice(0, 20);
  if (typeof body.category === "string" && body.category.trim())
    updates.category = body.category.trim().slice(0, 100);
  if (typeof body.finalDescription === "string")
    updates.finalDescription = body.finalDescription.trim();
  if (typeof body.totalQuantity === "number" && body.totalQuantity >= 0)
    updates.totalQuantity = Math.floor(body.totalQuantity);
  if (body.unit !== undefined)
    updates.unit = body.unit == null || body.unit === "" ? null : String(body.unit).slice(0, 20);

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(groupedItems)
    .set(updates as Record<string, string | number | null>)
    .where(
      and(
        eq(groupedItems.id, groupedId),
        eq(groupedItems.documentId, documentId)
      )
    )
    .returning();

  if (!updated) {
    return Response.json(
      { error: "Grouped item not found or access denied" },
      { status: 404 }
    );
  }

  return Response.json(updated);
}
