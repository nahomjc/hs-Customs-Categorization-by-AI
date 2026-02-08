import { db } from "@/db";
import { documents } from "@/db/schema";

export async function POST() {
  try {
    const [doc] = await db
      .insert(documents)
      .values({
        tenantId: "default-tenant",
        uploadedBy: "test-user",
        originalFileUrl: "default-tenant/seed/sample.pdf",
        originalFileName: "Sample Packing List.pdf",
        fileType: "pdf",
        status: "uploaded",
      })
      .returning({
        id: documents.id,
        originalFileName: documents.originalFileName,
      });

    return Response.json({
      success: true,
      message: "Document added to database",
      document: doc,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cause =
      error instanceof Error && error.cause instanceof Error
        ? error.cause.message
        : undefined;
    const hint =
      message.includes("does not exist") || cause?.includes("does not exist")
        ? "Run the SQL in db/schema.sql in Supabase Dashboard → SQL Editor to create the tables."
        : message.includes("permission") ||
          cause?.includes("policy") ||
          message.includes("row-level security")
        ? "Table may have RLS enabled. In Supabase SQL Editor run: ALTER TABLE documents DISABLE ROW LEVEL SECURITY;"
        : undefined;
    return Response.json(
      {
        success: false,
        message: "Failed to add document",
        error: message,
        ...(cause && { cause }),
        ...(hint && { hint }),
      },
      { status: 500 }
    );
  }
}
