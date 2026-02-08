import { NextRequest } from "next/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { v4 as uuid } from "uuid";

const BUCKET = "packing-lists";
const TENANT = "default-tenant";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const fileType = (form.get("fileType") as string) || "pdf";

  if (!file) {
    return Response.json({ error: "No file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const docId = uuid();
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${TENANT}/${docId}/file.${ext}`;

  const supabase = createAdminClient();
  let result = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });

  // Create bucket if it doesn't exist (e.g. first deploy), then retry upload
  if (result.error?.message?.includes("Bucket not found")) {
    await supabase.storage.createBucket(BUCKET, { public: false });
    result = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });
  }

  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 500 });
  }

  await db.insert(documents).values({
    id: docId,
    tenantId: TENANT,
    uploadedBy: "user",
    originalFileUrl: path,
    originalFileName: file.name,
    fileType: fileType as "pdf" | "docx" | "xlsx",
    status: "uploaded",
  });

  return Response.json({ documentId: docId });
}
