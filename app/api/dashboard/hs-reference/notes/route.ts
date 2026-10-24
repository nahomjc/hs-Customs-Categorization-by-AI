import { NextResponse } from "next/server";
import { requireAdmin, requireAdminOrAssessor } from "@/lib/auth/require-admin";
import {
  ChapterNotesForbiddenError,
  ChapterNotesNotFoundError,
  getChapterNotes,
  listChapterNoteSummaries,
  updateChapterNotes,
} from "@/lib/hs-chapter-notes";
import {
  normalizeChapter,
  updateChapterNotesSchema,
} from "@/lib/hs-chapter-notes-schema";

export const dynamic = "force-dynamic";

/** GET /notes -> chapter summaries; GET /notes?chapter=04 -> full notes. */
export async function GET(req: Request) {
  const auth = await requireAdminOrAssessor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const canEdit = auth.session.profile?.role === "admin";

  try {
    const chapterParam = new URL(req.url).searchParams.get("chapter");
    if (chapterParam !== null) {
      const chapter = normalizeChapter(chapterParam);
      if (!chapter) {
        return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });
      }
      const note = await getChapterNotes(chapter);
      if (!note) {
        return NextResponse.json(
          { error: "Chapter notes not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({ note, canEdit });
    }

    const notes = await listChapterNoteSummaries();
    return NextResponse.json({ notes, canEdit });
  } catch (error) {
    console.error("[hs-reference/notes] GET failed", error);
    return NextResponse.json(
      {
        error:
          "Could not load chapter notes. Run `npm run db:migrate` and `npm run db:seed-notes`.",
      },
      { status: 500 },
    );
  }
}

/** Admin only: update chapter notes (and optionally the section notes). */
export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateChapterNotesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  try {
    const note = await updateChapterNotes(
      { id: admin.session.authUser.id, role: admin.session.profile?.role ?? "" },
      parsed.data,
    );
    return NextResponse.json({ note });
  } catch (error) {
    if (error instanceof ChapterNotesForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ChapterNotesNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[hs-reference/notes] PATCH failed", error);
    return NextResponse.json({ error: "Failed to save notes" }, { status: 500 });
  }
}
