import { ALLOWED_HS_CODES, validateClassification } from "./allowedHsCodes";
import { applyAssessorRules } from "./assessorRules";
import { applyGriRuleEngine, type HsFeatures } from "./griRuleEngine";
import {
  formatReferenceCandidate,
  loadHsReferenceCache,
  searchDescriptions,
} from "./hsReference";
import { isReferencePopulated } from "./hsReferenceCache";
import { fetchOpenRouter } from "./openrouterFetch";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ClassificationResult {
  isImportItem: boolean;
  category: string;
  hsCode: string;
  cleanDescription: string;
  confidence?: number;
}

const ALLOWED_HS_LIST = [...ALLOWED_HS_CODES].join(", ");

function buildSystemPrompt(allowedList: string): string {
  return `You are a customs assessor. You NEVER invent HS codes. You choose ONLY from the allowed list.

Step 1 — Is this a physical import item?
- If the line is: document title, address, phone, date, "Packing List", "SQM" (unit only), "TIN NO", company name, "Unspecified item", "Geographical area", or any header/metadata → answer NO.
- If it describes a tangible product that can be imported (lamp, chair, wallpaper, fan, etc.) → answer YES.

Step 2 — If YES: What is the product? Write one short clean description (e.g. "Floor standing lamp", "Cafe chair").

Step 3 — Assign ONE category from: Lighting equipment, Furniture, Chairs & seating, Decor/artificial plants, HVAC (AC/fans), Textile/wallpaper, Hardware (handles/fittings), Decorative ceramics, Electrical equipment, Other.

Step 4 — Choose HS code ONLY from this list (no other codes allowed):
${allowedList}
Use format 9405 or 9405.10. For "Unclassified" real items use 9999. For non-items use EXCLUDE.

Rules (HS rulebook — do not guess by "meaning"):
- Lamps/lights → 9405. Chairs, sofas, stools → 9401. Tables, cabinets, shelves → 9403.
- Artificial plants, flowers → 6702. Sculptures, statuary → 9703 (NOT 6702).
- Wallpaper, wall coverings → 4814 (NOT 9404; 9404 is bedding/mattress).
- Ceramic vases, decorative ceramics → 6913 (NOT 6702).
- AC units → 8415. Fans → 8414. Fountain pumps / water features → 8413.
- Fibreglass / glass-wool heat insulation → 7019 (NOT 9999).
- Avoid 9999 unless the item is truly unclear; prefer a specific chapter when possible.
- Never use 0000.00 or 9999.99. Never invent a code not in the list.

Return ONLY valid JSON, no markdown:
{"isImportItem":true|false,"category":"Category Name","hsCode":"XXXX" or "EXCLUDE","cleanDescription":"Short product description"}`;
}

async function buildAllowedListForItem(
  description: string,
  features: HsFeatures & { isImportItem?: boolean },
): Promise<string> {
  await loadHsReferenceCache();

  if (!isReferencePopulated()) {
    return ALLOWED_HS_LIST;
  }

  const keywords = Array.isArray(features.keywords) ? features.keywords : [];
  const searchQuery = [description, features.itemType, features.material, features.use]
    .filter(Boolean)
    .join(" ");
  const candidates = await searchDescriptions(
    `${searchQuery} ${keywords.join(" ")}`,
    40,
  );

  if (candidates.length === 0) {
    return `${ALLOWED_HS_LIST}, 9999`;
  }

  const fromReference = candidates.map((row) => formatReferenceCandidate(row));
  const fallback = [...ALLOWED_HS_CODES].slice(0, 10);
  return [...fromReference, ...fallback, "9999", "EXCLUDE"].join("\n");
}

const FEATURE_EXTRACTOR_PROMPT = `You are a feature extractor for HS classification.
Extract product features from one packing-list line.
If the line is not a physical import item, still return JSON and set isImportItem=false.

Return ONLY valid JSON:
{"isImportItem":true|false,"itemType":"short noun","material":"material or unknown","use":"main use or unknown","keywords":["k1","k2"]}`;

function extractJson<T>(content: string): T {
  const cleaned = content.replace(/^```json\s*|\s*```$/g, "").trim();
  return JSON.parse(cleaned) as T;
}

async function callOpenRouter(
  messages: Array<{ role: "system" | "user"; content: string }>,
) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[HS classifyItem] OPENROUTER_API_KEY is not set");
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
      model: "openai/gpt-4o-mini",
      messages,
      temperature: 0.2,
      max_tokens: 256,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(
      "[HS classifyItem] OpenRouter API error:",
      res.status,
      err?.slice(0, 200),
    );
    throw new Error(`OpenRouter API error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from OpenRouter");
  return content;
}

export async function classifyItem(
  description: string,
  options?: { country?: string; unit?: string },
): Promise<ClassificationResult & { aiRawResponse?: string }> {
  console.log(
    "[HS classifyItem] calling API for:",
    `${description.slice(0, 60)}${description.length > 60 ? "..." : ""}`,
  );

  let featureUserContent = `Line from packing list: "${description}"`;
  if (options?.country) {
    featureUserContent += `\nCountry of origin: ${options.country}`;
  }
  if (options?.unit) {
    featureUserContent += `\nUnit: ${options.unit}`;
  }

  // Step 1: Feature extractor (AI)
  const featureContent = await callOpenRouter([
    { role: "system", content: FEATURE_EXTRACTOR_PROMPT },
    { role: "user", content: featureUserContent },
  ]);

  let features: HsFeatures & { isImportItem?: boolean };
  try {
    features = extractJson<HsFeatures & { isImportItem?: boolean }>(
      featureContent,
    );
  } catch {
    throw new Error(
      `Invalid JSON from feature extractor AI: ${featureContent}`,
    );
  }

  // Step 2: GRI rule engine (code)
  const gri = applyGriRuleEngine({
    itemType: features.itemType || "unknown",
    material: features.material || "unknown",
    use: features.use || "unknown",
    keywords: Array.isArray(features.keywords) ? features.keywords : [],
  });

  // Step 3: OpenRouter reasoning
  let reasoningUserContent = `Line from packing list: "${description}"`;
  if (options?.country) {
    reasoningUserContent += `\nCountry of origin: ${options.country}`;
  }
  if (options?.unit) {
    reasoningUserContent += `\nUnit: ${options.unit}`;
  }
  reasoningUserContent += `\nExtracted features JSON: ${JSON.stringify(features)}\nGRI rule-engine candidate HS: ${gri.suggestedHsCodes.join(", ")}\nGRI rationale: ${gri.rationale}`;

  const allowedList = await buildAllowedListForItem(description, features);
  const systemPrompt = buildSystemPrompt(allowedList);

  const content = await callOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: reasoningUserContent },
  ]);

  let parsed: ClassificationResult;
  try {
    parsed = extractJson<ClassificationResult>(content);
  } catch {
    throw new Error(`Invalid JSON from reasoning AI: ${content}`);
  }

  console.log(
    "[HS classifyItem] AI raw → hsCode:",
    parsed.hsCode,
    "| category:",
    parsed.category,
    "| isImportItem:",
    parsed.isImportItem,
  );

  // Normalize: non-items must have EXCLUDE and consistent category
  if (parsed.isImportItem === false || features.isImportItem === false) {
    parsed.hsCode = "EXCLUDE";
    parsed.category = "Non-item";
    parsed.isImportItem = false;
  }
  if (parsed.hsCode === "9999.99" || parsed.hsCode === "0000.00")
    parsed.hsCode = "9999";

  const inputDesc = description.trim();
  const final = applyAssessorRules(inputDesc, parsed);
  if (final.hsCode !== parsed.hsCode) {
    console.log(
      "[HS classifyItem] assessor override:",
      parsed.hsCode,
      "→",
      final.hsCode,
      "| category:",
      final.category,
    );
  }

  // Senior-assessor validation: exact HS only, category gate, no hallucinated subcodes
  const validated = validateClassification({
    hsCode: final.hsCode,
    category: final.category,
  });
  if (validated.status === "exclude") {
    final.hsCode = validated.hsCode;
    final.category = "Non-item";
    final.isImportItem = false;
  } else if (
    validated.status === "review" &&
    validated.hsCode !== final.hsCode
  ) {
    console.log(
      "[HS classifyItem] validation → review (exact HS):",
      final.hsCode,
      "→",
      validated.hsCode,
    );
    final.hsCode = validated.hsCode;
  } else if (validated.status === "valid") {
    final.hsCode = validated.hsCode;
  }

  return {
    ...final,
    isImportItem: final.isImportItem !== false,
    confidence: final.confidence ?? parsed.confidence ?? 0.9,
    aiRawResponse: content,
  };
}
