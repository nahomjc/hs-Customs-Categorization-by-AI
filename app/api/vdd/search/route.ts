import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { importProducts } from "@/db/schema";
import { getAuthUser } from "@/lib/auth/session";
import {
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/import-cases/api-helpers";
import { getTenantId } from "@/lib/import-cases/queries";
import { persistVddMatchesForProduct } from "@/lib/vdd/persist-product-matches";
import {
  buildPriceComparison,
  searchVddMatches,
  summarizeVddEvidence,
} from "@/lib/vdd/search-matches";
import {
  buildSearchProfileFromFields,
  buildSearchProfileFromProduct,
} from "@/lib/vdd/search-profile";

export const runtime = "nodejs";

const searchBodySchema = z.object({
  productId: z.string().uuid().optional(),
  persist: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  productName: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  productType: z.string().optional().nullable(),
  material: z.string().optional().nullable(),
  originCode: z.string().optional().nullable(),
  unitOfMeasure: z.string().optional().nullable(),
  condition: z.string().optional().nullable(),
  unitPrice: z.number().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const tenantId = getTenantId();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = searchBodySchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const limit = parsed.data.limit ?? 20;
  let profile = buildSearchProfileFromFields(parsed.data);
  let product: typeof importProducts.$inferSelect | null = null;

  if (parsed.data.productId) {
    const [row] = await db
      .select()
      .from(importProducts)
      .where(eq(importProducts.id, parsed.data.productId))
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    product = row;
    profile = buildSearchProfileFromProduct(row);
  }

  if (parsed.data.persist && product) {
    const result = await persistVddMatchesForProduct(tenantId, product, {
      limit,
      profile,
    });
    const evidence = summarizeVddEvidence(result.matches.slice(0, 5));
    return NextResponse.json({
      ok: true,
      profile,
      matchCount: result.matchCount,
      priceComparison: result.priceComparison,
      evidence,
      matches: result.matches.slice(0, limit).map(serializeMatch),
      disclaimer:
        "VDD references support review only. They do not determine the final HS code or customs value.",
    });
  }

  const matches = await searchVddMatches(tenantId, profile, limit);
  const priceComparison = buildPriceComparison(profile, matches);
  const evidence = summarizeVddEvidence(matches.slice(0, 5));

  return NextResponse.json({
    ok: true,
    profile,
    matchCount: matches.length,
    priceComparison,
    evidence,
    matches: matches.map(serializeMatch),
    disclaimer:
      "VDD references support review only. They do not determine the final HS code or customs value.",
  });
}

function serializeMatch(
  m: Awaited<ReturnType<typeof searchVddMatches>>[number],
) {
  const r = m.record;
  return {
    id: r.id,
    similarityScore: m.similarityScore,
    matchReasons: m.matchReasons,
    differences: m.differences,
    hsCode: r.hsCode,
    commonName: r.commonName,
    commercialDescription: r.commercialDescription,
    brandOrMake: r.brandOrMake,
    model: r.model,
    originCode: r.originCode,
    countryName: r.countryName,
    unitOfQuantity: r.unitOfQuantity,
    declaredUnitPrice: r.declaredUnitPrice,
    currencyCode: r.currencyCode,
    material: r.material,
    productType: r.productType,
    condition: r.condition,
  };
}
