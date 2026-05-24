import { PageHeader } from "@/components/dashboard/ui";
import { db } from "@/db";
import { documents } from "@/db/schema";
import {
  clampPreferencesForRole,
  DEFAULT_PREFERENCES,
} from "@/lib/auth/settings-meta";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { documentScopeFilter } from "@/lib/settings/document-scope";
import { getUserPreferences } from "@/lib/settings/user-settings";
import { desc } from "drizzle-orm";
import { HistoryTable } from "./HistoryTable";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  let list: {
    id: string;
    originalFileName: string | null;
    status: string | null;
    createdAt: Date | null;
  }[] = [];

  const session = await getSessionUserProfile();
  const authUser = session?.authUser;
  const prefs = authUser?.id
    ? clampPreferencesForRole(
        await getUserPreferences(authUser.id),
        session?.profile?.role
      )
    : { ...DEFAULT_PREFERENCES };

  try {
    const scope =
      authUser?.email && authUser.id
        ? documentScopeFilter(
            {
              id: authUser.id,
              email: authUser.email,
              role: session?.profile?.role,
            },
            prefs
          )
        : undefined;

    const base = db
      .select({
        id: documents.id,
        originalFileName: documents.originalFileName,
        status: documents.status,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .orderBy(desc(documents.createdAt))
      .limit(prefs.historyPageSize);

    list = scope ? await base.where(scope) : await base;
  } catch {
    // DB not configured
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="History"
        description="Uploaded packing lists and their processing status."
      />
      <HistoryTable list={list} />
    </div>
  );
}
