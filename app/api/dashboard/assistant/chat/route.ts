import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { completeChat, type ChatMessage } from "@/lib/ai/openrouter-chat";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { documentsUploadedByUser } from "@/lib/dashboard/document-ownership";
import { createClient } from "@/lib/supabase/server";

const MAX_HISTORY = 12;

type ClientMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { message?: string; history?: ClientMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = String(body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (m): m is ClientMessage =>
            !!m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string"
        )
        .slice(-MAX_HISTORY)
    : [];

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "User";

  let recentDocsSummary = "No documents uploaded yet.";
  try {
    const uploadFilter = documentsUploadedByUser({
      id: user.id,
      email: user.email ?? "",
      tenantId: DEFAULT_TENANT_ID,
    });

    const recent = await db
      .select({
        originalFileName: documents.originalFileName,
        status: documents.status,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(uploadFilter)
      .orderBy(desc(documents.createdAt))
      .limit(8);

    if (recent.length > 0) {
      recentDocsSummary = recent
        .map(
          (d) =>
            `- ${d.originalFileName ?? "Untitled"} (${d.status ?? "uploaded"}, ${d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "—"})`
        )
        .join("\n");
    }
  } catch {
    recentDocsSummary = "(document list unavailable)";
  }

  const systemPrompt = `You are the Impact Logistics AI assistant on the customs / HS code dashboard.

You help users with:
- Uploading and processing packing lists (PDF, Word, Excel)
- Understanding HS code grouping and customs classification workflows
- Navigating the app: Dashboard, Upload, History, User list (admins), Settings
- General questions about harmonized system codes and document preparation for customs

The signed-in user is ${displayName} (${user.email ?? "unknown email"}).

Their recent uploads:
${recentDocsSummary}

Be concise, practical, and accurate. If you don't know something specific about their data, say so and suggest where in the app to look (e.g. History, open a document, Upload). Do not invent document contents or HS codes. For document-specific line items, tell them to open that document and use "Ask AI" on the document page.`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  try {
    const content = await completeChat(messages);
    return NextResponse.json({ content });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    const status = msg.includes("not configured") ? 503 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
