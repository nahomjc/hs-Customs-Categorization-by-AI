import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/import-cases/api-helpers";
import {
  GroupingPlanChangedError,
  finalizeGroupingRun,
  groupImportCaseProducts,
  startGroupingRun,
  writeGroupingSequences,
} from "@/lib/import-cases/group-products";
import { getImportCaseById, getTenantId } from "@/lib/import-cases/queries";

type RouteParams = { params: Promise<{ caseId: string }> };

/** Most groups one batch request may write (keeps each request short). */
const GROUP_MAX_BATCH = 25;

type BatchBody = {
  action?: unknown;
  planKey?: unknown;
  sequences?: unknown;
};

function parseSequences(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.length > GROUP_MAX_BATCH) return null;
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
 * POST /api/import-cases/:caseId/group
 *
 * - No body (or no `action`): one blocking run, exactly as before.
 * - `{ action: "start" }`                         -> build the plan, clear old groups
 * - `{ action: "products", planKey, sequences }`  -> save these groups (idempotent)
 * - `{ action: "finalize", planKey }`             -> verify, then write the audit entry
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
    // no JSON body: legacy single run
  }

  try {
    switch (body.action) {
      case undefined: {
        const result = await groupImportCaseProducts(caseId, tenantId, user.id, {
          replaceExisting: true,
        });
        return NextResponse.json(result);
      }
      case "start": {
        const info = await startGroupingRun(caseId, { replaceExisting: true });
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
        const results = await writeGroupingSequences(
          caseId,
          body.planKey,
          sequences,
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
        const result = await finalizeGroupingRun(
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
    const status = error instanceof GroupingPlanChangedError ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}