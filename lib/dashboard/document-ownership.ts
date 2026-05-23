import { documents } from "@/db/schema";
import { eq, or, sql, type SQL } from "drizzle-orm";

type UserRef = {
  id: string;
  email: string;
  tenantId?: string;
};

/** SQL filter: documents uploaded by this user (Supabase auth id or email on uploaded_by). */
export function documentsUploadedByUser(user: UserRef): SQL {
  const matchers: SQL[] = [eq(documents.uploadedBy, user.id)];
  if (user.email) {
    matchers.push(sql`lower(${documents.uploadedBy}) = lower(${user.email})`);
  }
  return matchers.length === 1 ? matchers[0] : (or(...matchers) as SQL);
}
