"use server";

import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { downloadObject } from "@/lib/storage/r2";
import { parseDocumentFromBuffer } from "@/lib/processDocument";
import { classifyDocumentBatch } from "@/lib/classifyDocumentItems";
import { getPreferencesForUploader } from "@/lib/settings/user-settings";
import type { FileType } from "@/lib/extractText";

/** Parse file into line items (fast). Client should call `classifyDocumentBatch` next. */
export async function startProcessingDocument(documentId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));
  if (!doc) return { error: "Document not found" };

  if (doc.status === "parsed" || doc.status === "ai_processed") {
    return { success: true as const, phase: "classify" as const };
  }

  if (doc.status !== "uploaded" && doc.status !== "failed") {
    return { error: "Document already processed" };
  }

  if (doc.status === "failed") {
    await db
      .update(documents)
      .set({ status: "uploaded", updatedAt: new Date() })
      .where(eq(documents.id, documentId));
  }

  const path = doc.originalFileUrl;
  let buffer: Buffer;
  try {
    buffer = await downloadObject(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Failed to download file: ${message}` };
  }

  const fileType = doc.fileType as FileType;

  try {
    const prefs = await getPreferencesForUploader(doc.uploadedBy);
    const classificationModeOverride =
      prefs.defaultClassificationMode === "auto"
        ? undefined
        : prefs.defaultClassificationMode;
    await parseDocumentFromBuffer(documentId, buffer, fileType, {
      classificationModeOverride,
    });
    return { success: true as const, phase: "classify" as const };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : String(e ?? "Processing failed");
    console.error("[startProcessingDocument]", documentId, e);
    await db
      .update(documents)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(documents.id, documentId));
    const { maybeNotifyDocumentFailed } = await import(
      "@/lib/settings/notify-document"
    );
    void maybeNotifyDocumentFailed(documentId, message);
    return { error: message };
  }
}

/** Classify the next batch of items (safe to call repeatedly; resumes stuck jobs). */
export async function runClassificationBatch(documentId: string) {
  const [doc] = await db
    .select({ status: documents.status })
    .from(documents)
    .where(eq(documents.id, documentId));
  if (!doc) return { error: "Document not found" };

  if (doc.status === "completed") {
    return {
      success: true as const,
      completed: true as const,
      totalItems: 0,
      classifiedCount: 0,
    };
  }

  if (doc.status !== "parsed" && doc.status !== "ai_processed") {
    return { error: "Document is not ready for classification" };
  }

  try {
    const result = await classifyDocumentBatch(documentId);
    if (result.error) {
      await db
        .update(documents)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(documents.id, documentId));
      const { maybeNotifyDocumentFailed } = await import(
        "@/lib/settings/notify-document"
      );
      void maybeNotifyDocumentFailed(documentId, result.error);
      return { error: result.error };
    }
    return {
      success: true as const,
      completed: result.completed,
      totalItems: result.totalItems,
      classifiedCount: result.classifiedCount,
    };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : String(e ?? "Classification failed");
    console.error("[runClassificationBatch]", documentId, e);
    return { error: message };
  }
}
