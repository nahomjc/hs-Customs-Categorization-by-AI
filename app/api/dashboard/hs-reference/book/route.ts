import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getBookSkeleton, getChapterBookData } from "@/lib/hsBook";
import { normalizeChapter } from "@/lib/hs-chapter-notes-schema";

export const dynamic = "force-dynamic";

/**
 * GET /book -> section > chapter tree (no tariff lines).
 * GET /book?chapter=04 -> that chapter's tariff lines grouped by heading.
 */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const chapterParam = new URL(req.url).searchParams.get("chapter");
    if (chapterParam !== null) {
      const chapter = normalizeChapter(chapterParam);
      if (!chapter) {
        return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });
      }
      const data = await getChapterBookData(chapter);
      return NextResponse.json(data);
    }

    const skeleton = await getBookSkeleton();
    return NextResponse.json(skeleton);
  } catch (error) {
    console.error("[hs-reference/book] GET failed", error);
    return NextResponse.json(
      { error: "Could not load the HS book view" },
      { status: 500 },
    );
  }
}