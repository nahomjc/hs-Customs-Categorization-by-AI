import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/import-cases/api-helpers";
import {
  ClassifyPlanChangedError,
  classifyImportCaseProducts,
  classifyProductSequences,
  finalizeClassifyRun,
  startClassifyRun,
} from "@/lib/import-cases/classify-products";
import { getImportCaseById, getTenantId } from "@/lib/import-cases/queries";
import { importCaseJson } from "@/lib/import-cases/revalidate-import-case-page";

type RouteParams = { params: Promise<{ caseId: string }> };

/**
 * Time budget: Vercel stops a function after 300s. One product can take up to
 * ~45s (feature extraction) + ~45s (reasoning) + all web calls together, which
 * are capped by HS_WEB_SEARCH_BUDGET_MS (default 100s: several searches for an
 * unclear name plus the chapter-notes re-check). That is ~190s worst case per
 * product. CLASSIFY_CONCURRENCY (4) products run in parallel, so one batch of
 * up to 4 (CLASSIFY_BATCH_SIZE, what the UI sends) is a single wave inside 300s.
 */
export const maxDuration = 300;

/** Most products one batch request may touch (keeps each request short). */
const CLASSIFY_MAX_BATCH = 4;

type BatchBody = {
  action?: unknown;
  planKey?: unknown;
  sequences?: unknown;
  forceAi?: unknown;
  /** "suspicious" on start = re-check only the products whose code does not fit. */
  scope?: unknown;
  /** Every product number of a re-check run (sent with each later request). */
  scopeSequences?: unknown;
};

/** The product numbers of a re-check run, or undefined for a normal run. */
function parseScopeSequences(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 1000) return undefined;
  const out: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 1) return undefined;
    out.push(item);
  }
  return out;
}

function parseSequences(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.length > CLASSIFY_MAX_BATCH) return null;
  const out: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 1) {
      return null;
    }
    out.push(item);
  }
  return out;
}

/**
 * POST /api/import-cases/:caseId/classify
 *
 * - No body / no `action` (optionally `{ forceAi }`): one blocking run, as before.
 * - `{ action: "start" }`                                   -> choose products, clear old suggestions
 * - `{ action: "start", scope: "suspicious" }`              -> re-check only codes that do not fit the product
 * - `{ action: "products", planKey, sequences, forceAi?, scopeSequences? }` -> classify these products (idempotent)
 * - `{ action: "finalize", planKey, scopeSequences? }`      -> case status + audit log
 *
 * The batch actions let the UI show real progress: each request is short and
 * the client drives the loop, so nothing depends on server memory.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  let body: BatchBody = {};
  try {
    const parsed = (await request.json()) as unknown;
    if (parsed && typeof parsed === "object") body = parsed as BatchBody;
  } catch {
    // empty / invalid body: treat as legacy one-shot without forceAi
  }
  const forceAi = body.forceAi === true;

  try {
    switch (body.action) {
      case undefined: {
        const result = await classifyImportCaseProducts(
          caseId,
          tenantId,
          user.id,
          {
            replaceExisting: true,
            forceAi,
          },
        );
        return importCaseJson(caseId, result);
      }
      case "start": {
        const info = await startClassifyRun(caseId, {
          replaceExisting: true,
          onlySuspicious: body.scope === "suspicious",
          audit: { tenantId, userId: user.id },
        });
        return importCaseJson(caseId, info);
      }
      case "products": {
        const sequences = parseSequences(body.sequences);
        if (typeof body.planKey !== "string" || !sequences) {
          return NextResponse.json(
            { error: "planKey and 1-4 sequences are required" },
            { status: 400 },
          );
        }
        const results = await classifyProductSequences(
          caseId,
          tenantId,
          body.planKey,
          sequences,
          { forceAi, scopeSequences: parseScopeSequences(body.scopeSequences) },
        );
        return importCaseJson(caseId, { results });
      }
      case "finalize": {
        if (typeof body.planKey !== "string") {
          return NextResponse.json(
            { error: "planKey is required" },
            { status: 400 },
          );
        }
        const result = await finalizeClassifyRun(
          caseId,
          tenantId,
          user.id,
          body.planKey,
          parseScopeSequences(body.scopeSequences),
        );
        return importCaseJson(caseId, result);
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof ClassifyPlanChangedError ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}