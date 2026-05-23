import { db } from "@/db";
import { documents } from "@/db/schema";
import { inArray, sql } from "drizzle-orm";

const LEGACY_UPLOAD_MARKERS = ["user", "test-user"] as const;

/**
 * Assign legacy uploaded_by placeholders to the user account that existed
 * at upload time (fallback: earliest admin).
 */
export async function backfillLegacyDocumentUploaders(): Promise<number> {
  const result = await db.execute(sql`
    UPDATE documents AS d
    SET
      uploaded_by = COALESCE(
        (
          SELECT u.id::text
          FROM users AS u
          WHERE u.created_at <= d.created_at
          ORDER BY u.created_at DESC
          LIMIT 1
        ),
        (
          SELECT u.id::text
          FROM users AS u
          WHERE u.role = 'admin'
          ORDER BY u.created_at ASC
          LIMIT 1
        )
      ),
      updated_at = now()
    WHERE d.uploaded_by IN ('user', 'test-user')
  `);

  return Number(result.count ?? 0);
}

export async function countLegacyDocumentUploaders(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(inArray(documents.uploadedBy, [...LEGACY_UPLOAD_MARKERS]));

  return row?.count ?? 0;
}
