/**
 * Phase 1 CLI smoke test for NLP HS-code search.
 *
 * Prerequisites:
 *   - DATABASE_URL in .env
 *   - OPENROUTER_API_KEY in .env
 *   - hs_code_reference populated (Dashboard → HS reference upload)
 *   - Migration applied: npm run db:migrate
 *
 * Run:
 *   npx tsx --env-file=.env scripts/test-hs-code-search.ts
 *   npx tsx --env-file=.env scripts/test-hs-code-search.ts "LED bulb 9 watt for home lighting"
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

import { runHsCodeSearch } from "../lib/hs-code-search";

const SAMPLE_QUERIES = [
  "men's cotton T-shirt",
  "LED bulb 9 watt for home lighting",
  "electric motor for workshop 370W",
  "plastic food container with lid",
  "stainless steel kitchen knife",
];

async function runOne(query: string): Promise<void> {
  console.log("\n" + "=".repeat(72));
  console.log(`QUERY: ${query}`);
  console.log("=".repeat(72));

  const result = await runHsCodeSearch({
    query,
    limit: 5,
    tariffMatchLimit: 20,
    // Skip DB log in smoke test unless TEST_HS_SEARCH_LOG=1
    logContext:
      process.env.TEST_HS_SEARCH_LOG === "1"
        ? {
            tenantId: process.env.DEFAULT_TENANT_ID ?? "default-tenant",
            userId: null,
          }
        : undefined,
  });

  console.log("\nExtracted attributes:");
  console.log(JSON.stringify(result.extractedAttributes, null, 2));

  console.log(
    `\nTariff matches (top ${Math.min(5, result.tariffMatches.length)} of ${result.tariffMatches.length}):`,
  );
  for (const m of result.tariffMatches.slice(0, 5)) {
    console.log(
      `  - ${m.hsCode} (${(m.relevanceScore * 100).toFixed(0)}%) ${m.officialDescription.slice(0, 80)}…`,
    );
  }

  console.log(`\nCandidates (${result.candidates.length}):`);
  for (const c of result.candidates) {
    console.log(
      `\n  #${c.rank}  HS ${c.hsCode}  confidence=${c.confidenceScore} (${c.confidenceLevel})`,
    );
    console.log(`  ${c.officialDescription.slice(0, 120)}`);
    console.log(`  Action: ${c.recommendedReviewerAction}`);
    console.log(`  Reasoning: ${c.reasoning.slice(0, 200)}`);
    if (c.missingInformation.length > 0) {
      console.log(`  Missing: ${c.missingInformation.join("; ")}`);
    }
  }

  console.log(`\nDisclaimer: ${result.disclaimer}`);
  if (result.searchLogId) {
    console.log(`Search log id: ${result.searchLogId}`);
  }
}

async function main(): Promise<void> {
  const argQuery = process.argv.slice(2).join(" ").trim();
  const queries = argQuery ? [argQuery] : SAMPLE_QUERIES;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  for (const q of queries) {
    await runOne(q);
  }
}

main().catch((err) => {
  console.error("\nHS code search test failed:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
