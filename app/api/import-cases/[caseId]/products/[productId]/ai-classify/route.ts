import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/import-cases/api-helpers";
import { classifySingleImportProduct } from "@/lib/import-cases/classify-products";
import { getImportCaseById, getTenantId } from "@/lib/import-cases/queries";
import { revalidateImportCasePage } from "@/lib/import-cases/revalidate-import-case-page";

type RouteParams = {
  params: Promise<{ caseId: string; productId: string }>;
};

/** One product: AI (up to ~90s) + web search (up to ~90s) fits inside Vercel's 300s limit. */
export const maxDuration = 300;

/** Single-product AI classify (not `/classify` — conflicts with case batch route in App Router). */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId, productId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  let forceAi = true;
  // undefined = keep the saved note; a string (even "") replaces it
  let note: string | undefined;
  try {
    const body = (await request.json()) as { forceAi?: boolean; note?: unknown };
    if (body.forceAi === false) forceAi = false;
    if (typeof body.note === "string") {
      if (body.note.length > 5000) {
        return NextResponse.json(
          { error: "The note is too long (500 characters at most)" },
          { status: 400 },
        );
      }
      note = body.note;
    }
  } catch {
    // default: force AI when user explicitly asks
  }

  try {
    const result = await classifySingleImportProduct(
      caseId,
      tenantId,
      productId,
      user.id,
      { forceAi, note },
    );
    revalidateImportCasePage(caseId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
