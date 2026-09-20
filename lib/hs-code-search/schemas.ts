import { z } from "zod";

export const HS_CODE_SEARCH_AI_MODEL = "openai/gpt-4o-mini";
export const HS_CODE_SEARCH_PROMPT_VERSION = "hs-code-search-v1";

export const DISCLAIMER =
  "These are suggested HS codes for review only and do not determine the final customs classification. A licensed clearing agent or reviewer must approve the final HS code.";

export const confidenceLevelSchema = z.enum(["low", "medium", "high"]);
export const reviewerActionSchema = z.enum([
  "approve",
  "request_more_information",
  "expert_review",
]);

export const productAttributesSchema = z.object({
  productName: z.string().nullable(),
  productType: z.string().nullable(),
  material: z.string().nullable(),
  function: z.string().nullable(),
  powerWatts: z.number().nullable(),
  voltage: z.string().nullable(),
  useCase: z.string().nullable(),
  condition: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  otherAttributes: z.string().nullable(),
  missingInformation: z.array(z.string()).default([]),
});

export type ProductAttributes = z.infer<typeof productAttributesSchema>;

export const tariffMatchSchema = z.object({
  hsCode: z.string().min(1),
  tariffNo: z.string().min(1),
  officialDescription: z.string().min(1),
  chapter: z.string().nullable(),
  heading: z.string().nullable(),
  dutyRate: z.string().nullable(),
  stdUnit: z.string().nullable(),
  relevanceScore: z.number().min(0).max(1),
  scoreBreakdown: z
    .object({
      productType: z.number(),
      material: z.number(),
      functionUse: z.number(),
      power: z.number(),
      keywordOverlap: z.number(),
      chapter: z.number(),
      rawTotal: z.number(),
    })
    .optional(),
});

export type TariffMatch = z.infer<typeof tariffMatchSchema>;

export const hsCodeCandidateSchema = z.object({
  rank: z.number().int().min(1).max(5),
  hsCode: z.string().min(1),
  officialDescription: z.string().min(1),
  confidenceScore: z.number().min(0).max(1),
  confidenceLevel: confidenceLevelSchema,
  reasoning: z.string().min(1),
  extractedAttributes: productAttributesSchema,
  missingInformation: z.array(z.string()),
  recommendedReviewerAction: reviewerActionSchema,
});

export type HsCodeCandidate = z.infer<typeof hsCodeCandidateSchema>;

export const hsCodeSearchResultSchema = z.object({
  query: z.string().min(1),
  productSummary: z.string(),
  extractedAttributes: productAttributesSchema,
  tariffMatches: z.array(tariffMatchSchema),
  candidates: z.array(hsCodeCandidateSchema).min(0).max(5),
  disclaimer: z.string(),
  searchLogId: z.string().uuid().nullable(),
  aiModelName: z.string(),
});

export type HsCodeSearchResult = z.infer<typeof hsCodeSearchResultSchema>;

/** AI ranker response shape before we merge attributes / clamp. */
export const rankAiResponseSchema = z.object({
  productSummary: z.string().default(""),
  candidates: z
    .array(
      z.object({
        rank: z.number().int().optional(),
        hsCode: z.string().min(1),
        officialDescription: z.string().optional(),
        confidenceScore: z.number().min(0).max(1),
        confidenceLevel: confidenceLevelSchema.optional(),
        reasoning: z.string().min(1),
        missingInformation: z.array(z.string()).optional(),
        recommendedReviewerAction: reviewerActionSchema.optional(),
      }),
    )
    .min(0)
    .max(5),
  disclaimer: z.string().optional(),
});

export function confidenceLevelFromScore(
  score: number,
): z.infer<typeof confidenceLevelSchema> {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

export function clampConfidence(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(1, Math.max(0, Math.round(score * 10000) / 10000));
}

/** POST /api/dashboard/hs-code-search body */
export const hsCodeSearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  limit: z.number().int().min(1).max(5).optional().default(5),
  tariffMatchLimit: z.number().int().min(5).max(50).optional().default(20),
  attributesOverride: productAttributesSchema.optional(),
});

export type HsCodeSearchRequest = z.infer<typeof hsCodeSearchRequestSchema>;
