import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { ensureUserProfile } from "@/lib/auth/ensure-profile";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { v4 as uuid } from "uuid";

const INVALID_UPLOADER_IDS = new Set(["user", "test-user"]);

const BUCKET = "packing-lists";

export async function POST(req: NextRequest) {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user?.id || INVALID_UPLOADER_IDS.has(user.id)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.email) {
    return Response.json({ error: "Account email is required" }, { status: 400 });
  }

  await ensureUserProfile({
    id: user.id,
    email: user.email,
    fullName:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null,
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
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

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      {
        error:
          msg.includes("Compact JWS") || msg.includes("JWT")
            ? "Invalid Supabase service role key. In Vercel, set SUPABASE_SERVICE_ROLE_KEY to the service_role secret from Project Settings → API (not the anon key)."
            : msg,
      },
      { status: 500 }
    );
  }

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
    const msg = result.error.message;
    return Response.json(
      {
        error:
          msg.includes("Compact JWS") || msg.includes("JWT")
            ? "Invalid Supabase key. In Vercel, set SUPABASE_SERVICE_ROLE_KEY to the service_role secret from Project Settings → API."
            : msg,
      },
      { status: 500 }
    );
  }

  const [inserted] = await db
    .insert(documents)
    .values({
      id: docId,
      tenantId,
      uploadedBy: user.id,
      originalFileUrl: path,
      originalFileName: file.name,
      fileType: fileType as "pdf" | "docx" | "xlsx",
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
