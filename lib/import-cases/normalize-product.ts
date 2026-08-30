import { z } from "zod";
import { AI_MODEL_NAME, PROMPT_VERSION } from "./extraction-schemas";

export const normalizeProductSchema = z.object({
  normalizedDescription: z.string(),
  productName: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  intendedUse: z.string().nullable().optional(),
  productType: z.string().nullable().optional(),
  technicalSpecifications: z.record(z.string(), z.unknown()).nullable().optional(),
  missingInformation: z.array(z.string()).optional(),
  normalizationConfidence: z.number().min(0).max(1).optional(),
});

export type NormalizeProductResult = z.infer<typeof normalizeProductSchema>;

export type NormalizeProductInput = {
  invoiceDescription: string;
  packingDescription?: string | null;
  supplierSku?: string | null;
  brand?: string | null;
  modelNumber?: string | null;
};

function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : content.trim();
  return JSON.parse(raw) as unknown;
}

function ruleBasedNormalize(input: NormalizeProductInput): NormalizeProductResult {
  const parts = [input.invoiceDescription, input.packingDescription]
    .filter(Boolean)
    .join(" | ");
  const brand = input.brand ? `, ${input.brand}` : "";
  const model = input.modelNumber ? ` ${input.modelNumber}` : "";
  const sku = input.supplierSku ? ` (SKU: ${input.supplierSku})` : "";

  return normalizeProductSchema.parse({
    normalizedDescription: `${input.invoiceDescription}${brand}${model}`.trim(),
    productName: input.invoiceDescription.slice(0, 255),
    material: null,
    intendedUse: null,
    productType: null,
    technicalSpecifications: {
      sourceText: parts,
      sku: input.supplierSku ?? null,
    },
    missingInformation: input.packingDescription ? [] : ["packing_list_description"],
    normalizationConfidence: 0.55,
  });
}

export async function normalizeProductDescription(
  input: NormalizeProductInput,
): Promise<NormalizeProductResult & { aiModelName: string; promptVersion: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    const result = ruleBasedNormalize(input);
    return {
      ...result,
      aiModelName: "rule-based",
      promptVersion: PROMPT_VERSION,
    };
  }

  const system = `You normalize import product descriptions for Ethiopian customs classification support.
This is decision support only — not a final customs decision.
Combine invoice and packing-list wording into one clear English product description.
Return ONLY valid JSON:
{
  "normalizedDescription": "clear product description",
  "productName": "short name or null",
  "material": "material or null",
  "intendedUse": "intended use or null",
  "productType": "product type or null",
  "technicalSpecifications": {},
  "missingInformation": ["list of missing details"],
  "normalizationConfidence": 0.0-1.0
}`;

  const user = `Invoice description: ${input.invoiceDescription}
Packing list description: ${input.packingDescription ?? "N/A"}
SKU: ${input.supplierSku ?? "N/A"}
Brand: ${input.brand ?? "N/A"}
Model: ${input.modelNumber ?? "N/A"}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3010",
      },
      body: JSON.stringify({
        model: AI_MODEL_NAME,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) throw new Error(`AI error ${res.status}`);

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty AI response");

    const parsed = normalizeProductSchema.parse(extractJson(content));
    return {
      ...parsed,
      aiModelName: AI_MODEL_NAME,
      promptVersion: PROMPT_VERSION,
    };
  } catch {
    const result = ruleBasedNormalize(input);
    return {
      ...result,
      aiModelName: "rule-based-fallback",
      promptVersion: PROMPT_VERSION,
    };
  }
}
