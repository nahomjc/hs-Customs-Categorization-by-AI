import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserProfile, requireAdmin } from "@/lib/auth/require-admin";
import { isStaffRole } from "@/lib/auth/roles";
import { getAuthUser } from "@/lib/auth/session";
import {
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/import-cases/api-helpers";
import { getTenantId } from "@/lib/import-cases/queries";
import {
  findOrCreateSupplier,
  listSuppliers,
} from "@/lib/suppliers/queries";

const createSupplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  countryCode: z.string().trim().max(3).optional().nullable(),
});

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listQuerySchema.safeParse(params);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const result = await listSuppliers({
    tenantId: getTenantId(),
    search: parsed.data.search,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const session = await getSessionUserProfile();
  if (!isStaffRole(session?.profile?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSupplierSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const supplier = await findOrCreateSupplier(
    getTenantId(),
    parsed.data.name,
    parsed.data.countryCode,
  );

  return NextResponse.json(supplier);
}
