import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  documents,
  documentItems,
  itemClassifications,
  groupedItems,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { DocumentView } from "./DocumentView";

export const dynamic = "force-dynamic";
/** Vercel Hobby caps at 60s; Pro allows up to 300s. */
export const maxDuration = 300;

function getDbError(e: unknown): string {
  const err = e as { cause?: { message?: string }; message?: string };
  return err?.cause?.message ?? err?.message ?? String(e);
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let doc: (typeof documents)["$inferSelect"] | undefined;
  try {
    const rows = await db.select().from(documents).where(eq(documents.id, id));
    doc = rows[0];
  } catch (e) {
    console.error("[DocumentPage] db error", getDbError(e));
    throw new Error(`Database error: ${getDbError(e)}`);
  }
  if (!doc) notFound();

  const items = await db
    .select({
      id: documentItems.id,
      rawLine: documentItems.rawLine,
      detectedDescription: documentItems.detectedDescription,
      detectedQuantity: documentItems.detectedQuantity,
      detectedUnit: documentItems.detectedUnit,
      sourceHsCode: documentItems.sourceHsCode,
      lineNumber: documentItems.lineNumber,
      aiCategory: itemClassifications.aiCategory,
      aiHsCode: itemClassifications.aiHsCode,
      cleanDescription: itemClassifications.cleanDescription,
      aiRawResponse: itemClassifications.aiRawResponse,
    })
    .from(documentItems)
    .leftJoin(
      itemClassifications,
      eq(documentItems.id, itemClassifications.itemId),
    )
    .where(eq(documentItems.documentId, id))
    .orderBy(documentItems.lineIndex);

  const grouped = await db
    .select()
    .from(groupedItems)
    .where(eq(groupedItems.documentId, id));

  return (
    <DocumentView
      documentId={id}
      status={doc.status}
      fileName={doc.originalFileName}
      classificationMode={doc.classificationMode}
      items={items}
      grouped={grouped}
    />
  );
}
