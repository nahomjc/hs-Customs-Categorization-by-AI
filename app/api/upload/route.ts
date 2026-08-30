import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { documents } from "@/db/schema";
import { ensureUserProfile } from "@/lib/auth/ensure-profile";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { getAuthUser } from "@/lib/auth/session";
import { uploadObject } from "@/lib/storage/r2";

const INVALID_UPLOADER_IDS = new Set(["user", "test-user"]);

export async function POST(req: NextRequest) {
  const user = await getAuthUser();

  if (!user?.id || INVALID_UPLOADER_IDS.has(user.id)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.email) {
    return Response.json({ error: "Account email is required" }, { status: 400 });
  }

  await ensureUserProfile({
    id: user.id,
    email: user.email,
    fullName: user.name ?? null,
    avatarUrl: user.image ?? null,
  });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const fileType = (form.get("fileType") as string) || "pdf";

  if (!file) {
    return Response.json({ error: "No file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const docId = uuid();
  const ext = file.name.split(".").pop() ?? "bin";
  const tenantId = DEFAULT_TENANT_ID;
  const path = `${tenantId}/${docId}/file.${ext}`;

  try {
    await uploadObject(path, buffer, file.type || "application/octet-stream");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }

  const [inserted] = await db
    .insert(documents)
    .values({
      id: docId,
      tenantId,
      uploadedBy: user.id,
      originalFileUrl: path,
      originalFileName: file.name,
      fileType: fileType as "pdf" | "docx" | "xlsx" | "csv",
      status: "uploaded",
    })
    .returning({ id: documents.id, uploadedBy: documents.uploadedBy });

  if (!inserted) {
    return Response.json({ error: "Failed to save document" }, { status: 500 });
  }

  if (inserted.uploadedBy !== user.id) {
    await db
      .update(documents)
      .set({ uploadedBy: user.id, updatedAt: new Date() })
      .where(eq(documents.id, docId));
  }

  return Response.json({ documentId: docId });
}
