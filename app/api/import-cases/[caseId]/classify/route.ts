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

type RouteParams = { params: Promise<{ caseId: string }> };

/** Most products one batch request may touch (keeps each request short). */
const CLASSIFY_MAX_BATCH = 25;

type BatchBody = {
  action?: unknown;
  planKey?: unknown;
  sequences?: unknown;
  forceAi?: unknown;
};

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
 * - `{ action: "products", planKey, sequences, forceAi? }`  -> classify these products (idempotent)
 * - `{ action: "finalize", planKey }`                       -> case status + audit log
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
    // bulk classify defaults to reference-first
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
        return NextResponse.json(result);
      }
      case "start": {
        const info = await startClassifyRun(caseId, { replaceExisting: true });
        return NextResponse.json(info);
      }
      case "products": {
        const sequences = parseSequences(body.sequences);
        if (typeof body.planKey !== "string" || !sequences) {
          return NextResponse.json(
            { error: "planKey and 1-25 sequences are required" },
            { status: 400 },
          );
        }
        const results = await classifyProductSequences(
          caseId,
          tenantId,
          body.planKey,
          sequences,
          { forceAi },
        );
        return NextResponse.json({ results });
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
        );
        return NextResponse.json(result);
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