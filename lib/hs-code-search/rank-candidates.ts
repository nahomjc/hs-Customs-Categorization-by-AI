import { callOpenRouter, extractJson } from "./extract-attributes";
import {
  DISCLAIMER,
  HS_CODE_SEARCH_AI_MODEL,
  clampConfidence,
  confidenceLevelFromScore,
  hsCodeCandidateSchema,
  rankAiResponseSchema,
  type HsCodeCandidate,
  type ProductAttributes,
  type TariffMatch,
} from "./schemas";

function normalizeHsKey(code: string): string {
  return code.replace(/[^0-9A-Za-z]/g, "").toLowerCase();
}

function findMatch(
  hsCode: string,
  matches: TariffMatch[],
): TariffMatch | undefined {
  const key = normalizeHsKey(hsCode);
  return matches.find((m) => {
    const hs = normalizeHsKey(m.hsCode);
    const tariff = normalizeHsKey(m.tariffNo);
    return hs === key || tariff === key || hs.startsWith(key) || key.startsWith(hs);
  });
}

function buildRankSystemPrompt(allowedList: string): string {
  return `You are an Ethiopian customs classification assistant.

Your task is to analyze a natural-language product description and propose possible HS-code candidates based on the official tariff descriptions provided.

Important rules:
1. This is decision support, not a final customs decision.
2. Do not choose a code because it has a lower duty or tax.
3. Compare the product description with the official tariff descriptions.
4. If important product details are missing, lower confidence and list the missing information.
5. Choose ONLY from the tariff candidates listed below — never invent an HS code.
6. Return valid JSON only (no markdown).

ALLOWED TARIFF CANDIDATES (choose only from these HS codes):
${allowedList}

Return this JSON shape:
{
  "productSummary": "string",
  "candidates": [
    {
      "rank": 1,
      "hsCode": "string",
      "officialDescription": "string",
      "confidenceScore": 0.0,
      "confidenceLevel": "low | medium | high",
      "reasoning": "string",
      "missingInformation": [],
      "recommendedReviewerAction": "approve | request_more_information | expert_review"
    }
  ],
  "disclaimer": "These are suggested HS codes for review only and do not determine the final customs classification."
}

Return 1 to 5 candidates, ordered best-first. Prefer the most specific matching subheading when several fit.`;
}

/**
 * Rank tariff matches with OpenRouter. Candidates must come from `tariffMatches`.
 */
export async function rankHsCodeCandidates(
  queryText: string,
  productAttributes: ProductAttributes,
  tariffMatches: TariffMatch[],
  limit = 5,
): Promise<{
  productSummary: string;
  candidates: HsCodeCandidate[];
  disclaimer: string;
  aiModelName: string;
}> {
  const maxCandidates = Math.min(5, Math.max(1, limit));

  if (tariffMatches.length === 0) {
    return {
      productSummary:
        productAttributes.productName ??
        productAttributes.productType ??
        queryText.trim(),
      candidates: [],
      disclaimer: DISCLAIMER,
      aiModelName: HS_CODE_SEARCH_AI_MODEL,
    };
  }

  const topForPrompt = tariffMatches.slice(0, 20);
  const allowedList = topForPrompt
    .map(
      (m, i) =>
        `${i + 1}. HS ${m.hsCode} (tariff ${m.tariffNo}) [relevance ${m.relevanceScore.toFixed(2)}]: ${m.officialDescription}`,
    )
    .join("\n");

  const userContent = `USER QUERY:
${queryText.trim()}

EXTRACTED PRODUCT ATTRIBUTES:
${JSON.stringify(productAttributes, null, 2)}

TARIFF CANDIDATES:
${JSON.stringify(
  topForPrompt.map((m) => ({
    hsCode: m.hsCode,
    tariffNo: m.tariffNo,
    officialDescription: m.officialDescription,
    relevanceScore: m.relevanceScore,
    chapter: m.chapter,
  })),
  null,
  2,
)}`;

  const content = await callOpenRouter(
    [
      { role: "system", content: buildRankSystemPrompt(allowedList) },
      { role: "user", content: userContent },
    ],
    1200,
  );

  let raw: unknown;
  try {
    raw = extractJson(content);
  } catch {
    throw new Error(`Invalid JSON from HS ranker: ${content}`);
  }

  const parsed = rankAiResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`HS ranker failed validation: ${parsed.error.message}`);
  }

  const allowedKeys = new Set(
    topForPrompt.flatMap((m) => [
      normalizeHsKey(m.hsCode),
      normalizeHsKey(m.tariffNo),
    ]),
  );

  const candidates: HsCodeCandidate[] = [];
  for (const c of parsed.data.candidates) {
    const match = findMatch(c.hsCode, topForPrompt);
    if (!match) continue;
    if (
      !allowedKeys.has(normalizeHsKey(match.hsCode)) &&
      !allowedKeys.has(normalizeHsKey(match.tariffNo))
    ) {
      continue;
    }

    const score = clampConfidence(c.confidenceScore);
    const missing = [
      ...(c.missingInformation ?? []),
      ...productAttributes.missingInformation,
    ];
    const uniqueMissing = [...new Set(missing.map((m) => m.trim()).filter(Boolean))];

    const candidate = hsCodeCandidateSchema.parse({
      rank: candidates.length + 1,
      hsCode: match.hsCode,
      officialDescription:
        c.officialDescription?.trim() || match.officialDescription,
      confidenceScore: score,
      confidenceLevel: confidenceLevelFromScore(score),
      reasoning: c.reasoning,
      extractedAttributes: productAttributes,
      missingInformation: uniqueMissing,
      recommendedReviewerAction:
        c.recommendedReviewerAction ??
        (uniqueMissing.length > 0
          ? "request_more_information"
          : score >= 0.8
            ? "approve"
            : "expert_review"),
    });

    candidates.push(candidate);
    if (candidates.length >= maxCandidates) break;
  }

  // Fallback: if AI returned nothing usable, surface top deterministic matches
  if (candidates.length === 0) {
    for (const match of topForPrompt.slice(0, maxCandidates)) {
      const score = clampConfidence(match.relevanceScore * 0.75);
      candidates.push(
        hsCodeCandidateSchema.parse({
          rank: candidates.length + 1,
          hsCode: match.hsCode,
          officialDescription: match.officialDescription,
          confidenceScore: score,
          confidenceLevel: confidenceLevelFromScore(score),
          reasoning:
            "Ranked from tariff keyword relevance only because the AI ranker did not return a usable candidate. A human reviewer must confirm the suggested HS code.",
          extractedAttributes: productAttributes,
          missingInformation: productAttributes.missingInformation,
          recommendedReviewerAction:
            productAttributes.missingInformation.length > 0
              ? "request_more_information"
              : "expert_review",
        }),
      );
    }
  }

  return {
    productSummary:
      parsed.data.productSummary.trim() ||
      productAttributes.productName ||
      productAttributes.productType ||
      queryText.trim(),
    candidates,
    disclaimer: parsed.data.disclaimer?.trim() || DISCLAIMER,
    aiModelName: HS_CODE_SEARCH_AI_MODEL,
  };
}
