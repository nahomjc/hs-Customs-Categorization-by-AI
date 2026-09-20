import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { vddImportBatches } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/require-admin";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";

export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const tenantId = admin.session.profile.tenantId ?? DEFAULT_TENANT_ID;

  const batches = await db
    .select({
      id: vddImportBatches.id,
      sourceFileName: vddImportBatches.sourceFileName,
      sheetName: vddImportBatches.sheetName,
      status: vddImportBatches.status,
      rowCount: vddImportBatches.rowCount,
      validRowCount: vddImportBatches.validRowCount,
      invalidRowCount: vddImportBatches.invalidRowCount,
      extraColumns: vddImportBatches.extraColumns,
      createdAt: vddImportBatches.createdAt,
      completedAt: vddImportBatches.completedAt,
    })
    .from(vddImportBatches)
    .where(eq(vddImportBatches.tenantId, tenantId))
    .orderBy(desc(vddImportBatches.createdAt))
    .limit(20);

  return NextResponse.json({
    ok: true,
    batches,
    disclaimer:
      "VDD references support review only. They do not determine the final HS code or customs value.",
  });
}
