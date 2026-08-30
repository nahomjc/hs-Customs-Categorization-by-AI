import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { hsCodeReference } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/require-admin";
import { parseHsTariffBookBuffer } from "@/lib/importHsTariffBook";
import {
  invalidateHsReferenceCacheServer,
  loadHsReferenceCache,
} from "@/lib/hsReference";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    return NextResponse.json(
      { error: "Please upload an Excel file (.xlsx or .xls)" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseHsTariffBookBuffer(buffer);

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        error: "No tariff rows found in the file. Check the Excel format.",
        skipped: parsed.skipped,
        errors: parsed.errors,
      },
      { status: 400 },
    );
  }

  const importedAt = new Date().toISOString();

  const existingRows = await db
    .select({ tariffNo: hsCodeReference.tariffNo })
    .from(hsCodeReference);
  const existingTariffs = new Set(existingRows.map((r) => r.tariffNo));

  let inserted = 0;
  let updated = 0;
  for (const row of parsed.rows) {
    if (existingTariffs.has(row.tariffNo)) updated++;
    else inserted++;
  }

  await db.transaction(async (tx) => {
    const chunkSize = 200;
    for (let i = 0; i < parsed.rows.length; i += chunkSize) {
      const chunk = parsed.rows.slice(i, i + chunkSize).map((row) => ({
        heading: row.heading,
        hsCode: row.hsCode,
        tariffNo: row.tariffNo,
        description: row.description,
        stdUnit: row.stdUnit,
        dutyRate: row.dutyRate,
        chapter: row.chapter,
        normalizedHs: row.normalizedHs,
        importedAt,
      }));
      await tx
        .insert(hsCodeReference)
        .values(chunk)
        .onConflictDoUpdate({
          target: hsCodeReference.tariffNo,
          set: {
            heading: sql`excluded.heading`,
            hsCode: sql`excluded.hs_code`,
            description: sql`excluded.description`,
            stdUnit: sql`excluded.std_unit`,
            dutyRate: sql`excluded.duty_rate`,
            chapter: sql`excluded.chapter`,
            normalizedHs: sql`excluded.normalized_hs`,
            importedAt: sql`excluded.imported_at`,
          },
        });
    }
  });

  invalidateHsReferenceCacheServer();
  await loadHsReferenceCache(true);

  const chapters = [
    ...new Set(parsed.rows.map((r) => r.chapter).filter(Boolean) as string[]),
  ].sort();

  return NextResponse.json({
    ok: true,
    imported: parsed.rows.length,
    inserted,
    updated,
    skipped: parsed.skipped,
    sheetCount: parsed.sheetCount,
    chapters,
    chapterRange:
      chapters.length > 0
        ? `${chapters[0]} – ${chapters[chapters.length - 1]}`
        : null,
    errors: parsed.errors,
    importedAt,
  });
}
