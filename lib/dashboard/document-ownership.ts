import { documents } from "@/db/schema";
import { and, eq, or, type SQL } from "drizzle-orm";

/** Values used before upload API stored the authenticated user id. */
const LEGACY_UPLOAD_MARKERS = ["user", "test-user"] as const;

type UserRef = {
  id: string;
  email: string;
  tenantId: string;
};

/** SQL filter: documents belonging to this user (id, email, or legacy tenant uploads). */
export function documentsUploadedByUser(user: UserRef): SQL {
  const legacyMarkerMatch = or(
    ...LEGACY_UPLOAD_MARKERS.map((marker) =>
      eq(documents.uploadedBy, marker)
    )
  );

  return or(
    eq(documents.uploadedBy, user.id),
    eq(documents.uploadedBy, user.email),
    and(eq(documents.tenantId, user.tenantId), legacyMarkerMatch)
  ) as SQL;
}
