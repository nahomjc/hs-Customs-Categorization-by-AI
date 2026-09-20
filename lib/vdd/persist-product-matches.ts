import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vddProductMatches } from "@/db/schema";
import {
  buildPriceComparison,
  searchVddMatches,
} from "./search-matches";
import {
  buildSearchProfileFromProduct,
  type VddSearchProfile,
} from "./search-profile";
import type { VddScoredMatch } from "./score-match";
import type { ImportProductRow } from "@/db/schema/importProducts";

const EVIDENCE_TOP_N = 5;

export type PersistVddMatchesResult = {
  matchCount: number;
  matches: VddScoredMatch[];
  priceComparison: ReturnType<typeof buildPriceComparison>;
};

/**
 * Replace VDD matches for a product and mark top N as evidence.
 */
export async function persistVddMatchesForProduct(
  tenantId: string,
  product: Pick<
    ImportProductRow,
    | "id"
    | "brand"
    | "modelNumber"
    | "productName"
    | "normalizedDescription"
    | "rawDescription"
    | "productType"
    | "material"
    | "countryOfOriginCode"
    | "unitOfMeasure"
    | "unitPrice"
  >,
  options?: { limit?: number; profile?: VddSearchProfile },
): Promise<PersistVddMatchesResult> {
  const profile =
    options?.profile ?? buildSearchProfileFromProduct(product);
  const matches = await searchVddMatches(
    tenantId,
    profile,
    options?.limit ?? 20,
  );
  const priceComparison = buildPriceComparison(profile, matches);

  await db
    .delete(vddProductMatches)
    .where(eq(vddProductMatches.productId, product.id));

  if (matches.length === 0) {
    return { matchCount: 0, matches: [], priceComparison };
  }

  await db.insert(vddProductMatches).values(
    matches.map((m, index) => ({
      productId: product.id,
      vddReferenceRecordId: m.record.id,
      similarityScore: m.similarityScore.toFixed(4),
      matchReasons: m.matchReasons,
      differences: m.differences,
      hsCodeMatches: null,
      priceComparison: index === 0 ? priceComparison : null,
      isUsedAsEvidence: index < EVIDENCE_TOP_N,
    })),
  );

  return { matchCount: matches.length, matches, priceComparison };
}

export async function persistVddMatchesForProducts(
  tenantId: string,
  products: Array<
    Pick<
      ImportProductRow,
      | "id"
      | "brand"
      | "modelNumber"
      | "productName"
      | "normalizedDescription"
      | "rawDescription"
      | "productType"
      | "material"
      | "countryOfOriginCode"
      | "unitOfMeasure"
      | "unitPrice"
    >
  >,
): Promise<{ totalMatches: number }> {
  let totalMatches = 0;
  for (const product of products) {
    const result = await persistVddMatchesForProduct(tenantId, product);
    totalMatches += result.matchCount;
  }
  return { totalMatches };
}
