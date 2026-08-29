import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  getReferenceStatsFromDb,
  listReferenceDb,
} from "@/lib/hsReference";
import type { HsReferenceSortField } from "@/lib/hsReferenceTypes";

const SORT_FIELDS = new Set<HsReferenceSortField>([
  "tariffNo",
  "hsCode",
  "description",
  "chapter",
  "heading",
  "dutyRate",
  "importedAt",
]);

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const chapter = searchParams.get("chapter")?.trim() ?? "";
  const sortByParam = searchParams.get("sortBy") ?? "tariffNo";
  const sortBy = SORT_FIELDS.has(sortByParam as HsReferenceSortField)
    ? (sortByParam as HsReferenceSortField)
    : "tariffNo";
  const sortOrder =
    searchParams.get("sortOrder") === "desc" ? "desc" : "asc";
  const page = Math.max(
    Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
    1,
  );
  const pageSize = Math.min(
    Math.max(Number.parseInt(searchParams.get("pageSize") ?? "25", 10) || 25, 1),
    100,
  );

  const [stats, list] = await Promise.all([
    getReferenceStatsFromDb(),
    listReferenceDb({
      q: q || undefined,
      chapter: chapter || undefined,
      sortBy,
      sortOrder,
      page,
      pageSize,
    }),
  ]);

  return NextResponse.json({ stats, ...list });
}
