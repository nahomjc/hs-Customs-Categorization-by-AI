import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { completeChat, type ChatMessage } from "@/lib/ai/openrouter-chat";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { documentsUploadedByUser } from "@/lib/dashboard/document-ownership";
import { getAuthUser } from "@/lib/auth/session";
import { classifyProductDescription } from "@/lib/import-cases/classify-product-description";

const MAX_HISTORY = 12;

type ClientMessage = { role: "user" | "assistant"; content: string };

function looksLikeHsClassificationQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  const hasHsIntent =
    /\bhs\s*code\b|\bharmonized\b|\btariff\b|\bclassif(y|ication)\b|\bwhat\s+code\b|\bwhich\s+code\b/.test(
      lower,
    );
  const hasProductSignal =
    /\b(oil|tea|sugar|bean|meat|lamp|chair|furniture|tomato|palm|soy|mandarin|import)\b/i.test(
      text,
    ) || text.length > 25;
  return hasHsIntent && hasProductSignal;
}

function extractProductDescriptionFromQuestion(text: string): string {
  const quoted =
    text.match(/["“](.+?)["”]/)?.[1] ??
    text.match(/for[:\s]+(.+?)(?:\?|$)/i)?.[1]?.trim();
  if (quoted && quoted.length >= 5) return quoted.trim();

  return text
    .replace(
      /^(what|which)\s+(is\s+)?(the\s+)?(hs\s*code|harmonized\s+code|tariff\s+code)\s+(for|of)\s+/i,
      "",
    )
    .replace(/\?+$/, "")
    .trim();
}

async function buildHsClassificationReply(description: string): Promise<string> {
  const result = await classifyProductDescription(description, { forceAi: true });

  if (!result.isImportItem || result.hsCode === "EXCLUDE") {
    return `I could not classify "${description}" as an import product. Try a clearer product description (e.g. "Palm olein RBD oil bulk").`;
  }

  const sourceLabel =
    result.source === "reference_match"
      ? "tariff reference match"
      : result.source === "ai_suggestion"
        ? "AI + tariff rules"
        : "rule fallback";

  const confidence =
    result.confidence != null
      ? ` (confidence ${Math.round(result.confidence * 100)}%)`
      : "";

  let reply = `Suggested HS code for "${result.cleanDescription || description}": **${result.hsCode}**${confidence}\n\nCategory: ${result.category}\nSource: ${sourceLabel}`;

  if (result.hsCode === "9999" || result.hsCode.startsWith("9999.")) {
    reply +=
      "\n\nThis needs human review — the system could not find a confident match. Upload your tariff book at HS Reference, or set the code manually on the Classification tab.";
  } else {
    reply +=
      "\n\nAlways verify against your national tariff schedule before declaration. For import cases, use the Classification tab → Ask AI on the product row.";
  }

  return reply;
}

export async function POST(request: Request) {
  const user = await getAuthUser();

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

  if (looksLikeHsClassificationQuestion(message)) {
    try {
      const description = extractProductDescriptionFromQuestion(message);
      const content = await buildHsClassificationReply(description);
      return NextResponse.json({ content });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Classification failed";
      return NextResponse.json(
        {
          content: `I couldn't classify that product (${msg}). Make sure OPENROUTER_API_KEY is set, or use Classification → Ask AI on your import case.`,
        },
        { status: 200 },
      );
    }
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

  const displayName = user.name ?? user.email ?? "User";

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

Be concise, practical, and accurate. If you don't know something specific about their data, say so and suggest where in the app to look (e.g. History, open a document, Upload). For HS code questions about a product description, the system will classify automatically — otherwise suggest the Classification tab → Ask AI. Do not invent document contents.`;

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
