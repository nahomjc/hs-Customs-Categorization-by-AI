import { db } from "@/db";
import { documents } from "@/db/schema";
import { removeObject } from "@/lib/storage/r2";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [doc] = await db
    .select({ id: documents.id, originalFileUrl: documents.originalFileUrl })
    .from(documents)
    .where(eq(documents.id, id));

  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    await removeObject(doc.originalFileUrl);
  } catch {
    // Ignore storage errors (e.g. file already gone)
  }

  try {
    await db.delete(documents).where(eq(documents.id, id));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
