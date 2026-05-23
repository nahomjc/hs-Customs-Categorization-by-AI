import type { NextRequest } from "next/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { v4 as uuid } from "uuid";

const BUCKET = "packing-lists";

export async function POST(req: NextRequest) {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  await db.insert(documents).values({
    id: docId,
    tenantId,
    uploadedBy: user.id,
    originalFileUrl: path,
    originalFileName: file.name,
    fileType: fileType as "pdf" | "docx" | "xlsx",
    status: "uploaded",
  });

  return Response.json({ documentId: docId });
}
