import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, importProducts } from "@/db/schema";
import { completeChat, type ChatMessage } from "@/lib/ai/openrouter-chat";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { documentsUploadedByUser } from "@/lib/dashboard/document-ownership";
import { getAuthUser } from "@/lib/auth/session";
import { classifyProductDescription } from "@/lib/import-cases/classify-product-description";
import {
  formatAskWhichProduct,
  formatHsChatReply,
  parseHsChatQuestion,
} from "@/lib/ai/hs-chat-intent";
import { getImportCaseById, getTenantId } from "@/lib/import-cases/queries";
import {
  buildImportCaseAssistantContext,
  parseImportCaseIdFromPath,
} from "@/lib/dashboard/import-case-assistant-context";

const MAX_HISTORY = 12;

type ClientMessage = { role: "user" | "assistant"; content: string };

/** Descriptions of the products in an import case (tenant-checked); [] on any problem. */
async function loadCaseProductDescriptions(caseId: string): Promise<string[]> {
  try {
    const importCase = await getImportCaseById(caseId, getTenantId());
    if (!importCase) return [];
    const rows = await db
      .select({
        normalized: importProducts.normalizedDescription,
        raw: importProducts.rawDescription,
        name: importProducts.productName,
      })
      .from(importProducts)
      .where(eq(importProducts.importCaseId, caseId))
      .limit(300);
    return rows
      .map((r) => (r.normalized ?? r.raw ?? r.name ?? "").trim())
      .filter((d) => d.length > 0);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const user = await getAuthUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    message?: string;
    history?: ClientMessage[];
    page?: { pathname?: string; wizardStepId?: string | null };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = String(body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // HS code question: classify the named product directly (tariff book first,
  // then AI with web search) instead of pointing at another screen.
  const pageCaseId = body.page?.pathname
    ? parseImportCaseIdFromPath(String(body.page.pathname).trim())
    : null;
  const knownProducts = pageCaseId ? await loadCaseProductDescriptions(pageCaseId) : [];
  const hsQuestion = parseHsChatQuestion(message, knownProducts);
  if (hsQuestion.intent) {
    if (!hsQuestion.product) {
      return NextResponse.json({ content: formatAskWhichProduct(knownProducts) });
    }
    try {
      const result = await classifyProductDescription(hsQuestion.product, {
        forceAi: false,
        // the user asked for a code, so treat the text as a product
        assumeImportItem: true,
      });
      return NextResponse.json({
        content: formatHsChatReply(hsQuestion.product, result),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Classification failed";
      return NextResponse.json(
        {
          content: `I couldn't classify "${hsQuestion.product}" (${msg}). Check that OPENROUTER_API_KEY is set, then try again.`,
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

  const pathname = String(body.page?.pathname ?? "").trim();
  const caseIdFromPath = pathname ? parseImportCaseIdFromPath(pathname) : null;
  let importCaseContext: string | null = null;
  if (caseIdFromPath) {
    try {
      importCaseContext = await buildImportCaseAssistantContext(
        caseIdFromPath,
        body.page?.wizardStepId,
      );
    } catch {
      importCaseContext = null;
    }
  }

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
${importCaseContext ? `\n${importCaseContext}\n` : ""}

Be concise, practical, and accurate. If you don't know something specific about their data, say so and suggest where in the app to look (e.g. History, open a document, Upload). HS code questions that name a product are classified automatically by the system; if the user asks for an HS code without naming a product, ask which product. Do not invent document contents.${
    importCaseContext
      ? " When import case context is present, prioritize answering about that case and the wizard step the user is viewing."
      : ""
  }`;

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
