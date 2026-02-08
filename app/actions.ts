"use server";

import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";
import { processDocumentPipeline } from "@/lib/processDocument";
import type { FileType } from "@/lib/extractText";

const BUCKET = "packing-lists";

export async function startProcessingDocument(documentId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));
  if (!doc) return { error: "Document not found" };
  if (doc.status !== "uploaded") return { error: "Document already processed" };

  const supabase = createAdminClient();
  const path = doc.originalFileUrl;
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data)
    return {
      error: "Failed to download file: " + (error?.message ?? "no data"),
    };

  const buffer = Buffer.from(await data.arrayBuffer());
  const fileType = doc.fileType as FileType;

  try {
    await db
      .update(documents)
      .set({ status: "parsed", updatedAt: new Date() })
      .where(eq(documents.id, documentId));
    await processDocumentPipeline(documentId, buffer, fileType);
    return { success: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : String(e ?? "Processing failed");
    console.error("[startProcessingDocument]", documentId, e);
    await db
      .update(documents)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(documents.id, documentId));
    return { error: message };
  }
}
