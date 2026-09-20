import { fetchOpenRouter } from "@/lib/openrouterFetch";
import {
  HS_CODE_SEARCH_AI_MODEL,
  productAttributesSchema,
  type ProductAttributes,
} from "./schemas";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const EXTRACT_SYSTEM_PROMPT = `You are an Ethiopian customs classification assistant helping extract product attributes from a natural-language description.

This is decision support only — you do not decide the final HS code.

Extract structured product attributes. Use null when unknown.
List missingInformation for details a reviewer would need (e.g. material, voltage, whether LED is a bulb vs fixture).

Return ONLY valid JSON (no markdown) with this exact shape:
{
  "productName": string | null,
  "productType": string | null,
  "material": string | null,
  "function": string | null,
  "powerWatts": number | null,
  "voltage": string | null,
  "useCase": string | null,
  "condition": string | null,
  "brand": string | null,
  "model": string | null,
  "otherAttributes": string | null,
  "missingInformation": string[]
}`;

function extractJson(content: string): unknown {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in AI response");
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
}

async function callOpenRouter(
  messages: Array<{ role: "system" | "user"; content: string }>,
  maxTokens = 512,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const res = await fetchOpenRouter(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3010",
    },
    body: JSON.stringify({
      model: HS_CODE_SEARCH_AI_MODEL,
      messages,
      temperature: 0.1,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter API error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from OpenRouter");
  return content;
}

/**
 * Extract structured product attributes from a natural-language query.
 */
export async function extractProductAttributesFromQuery(
  queryText: string,
): Promise<ProductAttributes> {
  const trimmed = queryText.trim();
  if (!trimmed) {
    throw new Error("Query text is required");
  }

  const content = await callOpenRouter([
    { role: "system", content: EXTRACT_SYSTEM_PROMPT },
    { role: "user", content: `Product description:\n"${trimmed}"` },
  ]);

  let raw: unknown;
  try {
    raw = extractJson(content);
  } catch {
    throw new Error(`Invalid JSON from attribute extractor: ${content}`);
  }

  const parsed = productAttributesSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Attribute extractor failed validation: ${parsed.error.message}`,
    );
  }

  return parsed.data;
}

export { callOpenRouter, extractJson };
