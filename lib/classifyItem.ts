import { ALLOWED_HS_CODES } from "./allowedHsCodes";
import { applyAssessorRules } from "./assessorRules";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ClassificationResult {
  isImportItem: boolean;
  category: string;
  hsCode: string;
  cleanDescription: string;
  confidence?: number;
}

const ALLOWED_HS_LIST = [...ALLOWED_HS_CODES].join(", ");

const SYSTEM_PROMPT = `You are a customs assessor. You NEVER invent HS codes. You choose ONLY from the allowed list.

Step 1 — Is this a physical import item?
- If the line is: document title, address, phone, date, "Packing List", "SQM" (unit only), "TIN NO", company name, "Unspecified item", "Geographical area", or any header/metadata → answer NO.
- If it describes a tangible product that can be imported (lamp, chair, wallpaper, fan, etc.) → answer YES.

Step 2 — If YES: What is the product? Write one short clean description (e.g. "Floor standing lamp", "Cafe chair").

Step 3 — Assign ONE category from: Lighting equipment, Furniture, Chairs & seating, Decor/artificial plants, HVAC (AC/fans), Textile/wallpaper, Hardware (handles/fittings), Decorative ceramics, Electrical equipment, Other.

Step 4 — Choose HS code ONLY from this list (no other codes allowed):
${ALLOWED_HS_LIST}
Use format 9405 or 9405.10. For "Unclassified" real items use 9999. For non-items use EXCLUDE.

Rules (HS rulebook — do not guess by "meaning"):
- Lamps/lights → 9405. Chairs, sofas, stools → 9401. Tables, cabinets, shelves → 9403.
- Artificial plants, flowers → 6702. Sculptures, statuary → 9703 (NOT 6702).
- Wallpaper, wall coverings → 4814 (NOT 9404; 9404 is bedding/mattress).
- Ceramic vases, decorative ceramics → 6913 (NOT 6702).
- AC units → 8415. Fans → 8414. Fountain pumps / water features → 8413.
- Avoid 9999 unless the item is truly unclear; prefer a specific chapter when possible.
- Never use 0000.00 or 9999.99. Never invent a code not in the list.

Return ONLY valid JSON, no markdown:
{"isImportItem":true|false,"category":"Category Name","hsCode":"XXXX" or "EXCLUDE","cleanDescription":"Short product description"}`;

export async function classifyItem(
  description: string,
  options?: { country?: string; unit?: string }
): Promise<ClassificationResult & { aiRawResponse?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  let userContent = 'Line from packing list: "' + description + '"';
  if (options?.country)
    userContent += "\nCountry of origin: " + options.country;
  if (options?.unit) userContent += "\nUnit: " + options.unit;

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
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 256,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("OpenRouter API error: " + res.status + " " + err);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from OpenRouter");

  let parsed: ClassificationResult;
  try {
    const cleaned = content.replace(/^```json\s*|\s*```$/g, "").trim();
    parsed = JSON.parse(cleaned) as ClassificationResult;
  } catch {
    throw new Error("Invalid JSON from AI: " + content);
  }

  // Normalize: non-items must have EXCLUDE and consistent category
  if (parsed.isImportItem === false) {
    parsed.hsCode = "EXCLUDE";
    parsed.category = "Non-item";
  }
  if (parsed.hsCode === "9999.99" || parsed.hsCode === "0000.00")
    parsed.hsCode = "9999";

  // Apply assessor rulebook overrides (sculpture→9703, wallpaper→4814, vague→NEED_INFO, etc.)
  const inputDesc = description.trim();
  const final = applyAssessorRules(inputDesc, parsed);

  return {
    ...final,
    isImportItem: final.isImportItem !== false,
    confidence: final.confidence ?? parsed.confidence ?? 0.9,
    aiRawResponse: content,
  };
}
