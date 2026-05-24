import { PageHeader } from "@/components/dashboard/ui";
import { clampPreferencesForRole } from "@/lib/auth/settings-meta";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { getUserPreferences } from "@/lib/settings/user-settings";
import { UploadForm } from "./UploadForm";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const session = await getSessionUserProfile();
  const userId = session?.authUser?.id;
  const prefs = userId
    ? clampPreferencesForRole(
        await getUserPreferences(userId),
        session?.profile?.role
      )
    : { autoOpenDocument: true };

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <PageHeader
        title="Upload packing list"
        description="Upload a PDF, Word, or Excel packing list. Lists that already include HS codes are read and grouped automatically."
      />
      <UploadForm autoOpenDocument={prefs.autoOpenDocument} />
    </div>
  );
}
