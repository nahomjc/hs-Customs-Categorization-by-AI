import { NextResponse } from "next/server";
import { requireAdminOrAssessor } from "@/lib/auth/require-admin";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { validationErrorResponse } from "@/lib/import-cases/api-helpers";
import { getRecentHsCodeSearches } from "@/lib/hs-code-search/history";
import {
  hsCodeSearchRequestSchema,
  runHsCodeSearch,
} from "@/lib/hs-code-search";

/**
 * POST — NLP HS-code search (decision support only).
 * GET  — recent searches for the current user.
 */
export async function POST(request: Request) {
  const access = await requireAdminOrAssessor();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = hsCodeSearchRequestSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const tenantId =
    access.session.profile.tenantId?.trim() || DEFAULT_TENANT_ID;

  try {
    const result = await runHsCodeSearch({
      query: parsed.data.query,
      limit: parsed.data.limit,
      tariffMatchLimit: parsed.data.tariffMatchLimit,
      attributesOverride: parsed.data.attributesOverride,
      logContext: {
        tenantId,
        userId: access.session.authUser.id,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "HS code search failed";
    const status = message.includes("reference is empty") ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: Request) {
  const access = await requireAdminOrAssessor();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? "10", 10) || 10),
  );
  const tenantId =
    access.session.profile.tenantId?.trim() || DEFAULT_TENANT_ID;

  const history = await getRecentHsCodeSearches({
    tenantId,
    userId: access.session.authUser.id,
    limit,
  });

  return NextResponse.json({ history });
}
