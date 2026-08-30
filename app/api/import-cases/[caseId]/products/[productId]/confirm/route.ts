import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  importProducts,
  productInvoiceLines,
  productPackingListLines,
} from "@/db/schema";
import { getAuthUser } from "@/lib/auth/session";
import {
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/import-cases/api-helpers";
import {
  getImportCaseById,
  getTenantId,
  writeAuditLog,
} from "@/lib/import-cases/queries";

type RouteParams = {
  params: Promise<{ caseId: string; productId: string }>;
};

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user?.id) return unauthorizedResponse();

  const { caseId, productId } = await params;
  const tenantId = getTenantId();
  const importCase = await getImportCaseById(caseId, tenantId);
  if (!importCase) return notFoundResponse("Import case not found");

  const [product] = await db
    .select()
    .from(importProducts)
    .where(
      and(
        eq(importProducts.id, productId),
        eq(importProducts.importCaseId, caseId),
      ),
    )
    .limit(1);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  await db
    .update(productInvoiceLines)
    .set({ isConfirmed: true })
    .where(eq(productInvoiceLines.productId, productId));

  await db
    .update(productPackingListLines)
    .set({ isConfirmed: true })
    .where(eq(productPackingListLines.productId, productId));

  const [updated] = await db
    .update(importProducts)
    .set({
      humanVerified: true,
      verifiedByUserId: user.id,
      verifiedAt: new Date(),
      status: "ready_for_hs_suggestion",
      updatedAt: new Date(),
    })
    .where(eq(importProducts.id, productId))
    .returning();

  await writeAuditLog({
    tenantId,
    importCaseId: caseId,
    userId: user.id,
    entityType: "import_product",
    entityId: productId,
    action: "product_verified",
    newData: { humanVerified: true },
  });

  return NextResponse.json(updated);
}
