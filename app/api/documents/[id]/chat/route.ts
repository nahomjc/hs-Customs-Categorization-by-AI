import { db } from "@/db";
import {
  documentItems,
  itemClassifications,
  groupedItems,
} from "@/db/schema";
import { eq } from "drizzle-orm";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_ITEMS_CONTEXT = 400;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return Response.json(
      { error: "message is required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OpenRouter API not configured" },
      { status: 503 }
    );
  }

  const items = await db
    .select({
      rawLine: documentItems.rawLine,
      detectedDescription: documentItems.detectedDescription,
      detectedQuantity: documentItems.detectedQuantity,
      detectedUnit: documentItems.detectedUnit,
      aiCategory: itemClassifications.aiCategory,
      aiHsCode: itemClassifications.aiHsCode,
      cleanDescription: itemClassifications.cleanDescription,
    })
    .from(documentItems)
    .leftJoin(
      itemClassifications,
      eq(documentItems.id, itemClassifications.itemId)
    )
    .where(eq(documentItems.documentId, documentId))
    .orderBy(documentItems.lineIndex)
    .limit(MAX_ITEMS_CONTEXT);

  const grouped = await db
    .select()
    .from(groupedItems)
    .where(eq(groupedItems.documentId, documentId));

  const itemsText = items
    .map((i) => {
      const desc =
        i.cleanDescription ?? i.detectedDescription ?? i.rawLine ?? "—";
      return `- ${desc} | Qty: ${i.detectedQuantity ?? "—"} | HS: ${i.aiHsCode ?? "—"} | Category: ${i.aiCategory ?? "—"}`;
    })
    .join("\n");

  const groupedText = grouped
    .map(
      (g) =>
        `- HS ${g.hsCode} | ${g.category} | Qty: ${g.totalQuantity} ${g.unit ?? "PCS"} | ${g.finalDescription}`
    )
    .join("\n");

  const systemPrompt = `You are an assistant for a customs assessor. You have access to the following document data. Answer questions about it concisely and accurately. Use the data below; do not invent information.

DETECTED ITEMS (line by line: Description | Qty | HS Code | Category):
${itemsText || "(none)"}

GROUPED BY HS CODE (HS Code | Category | Qty | Description):
${groupedText || "(none)"}

If the user asks about "need more description" or NEED_INFO, those are items that require a clearer description before classification.`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return Response.json(
      { error: "AI service error: " + res.status },
      { status: 502 }
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content =
    data.choices?.[0]?.message?.content?.trim() ?? "I couldn’t generate a response.";

  return Response.json({ content });
}
