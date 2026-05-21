import { SettingsPanel } from "@/components/dashboard/SettingsPanel";
import { PageHeader } from "@/components/dashboard/ui";
import { parsePreferences } from "@/lib/auth/settings-meta";
import { getDashboardUserDetail } from "@/lib/dashboard/users";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return null;
  }

  const row = await getDashboardUserDetail(user.id);
  const profile = row ?? {
    email: user.email,
    fullName:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null,
    role: "user",
    meta: {},
    tenantId: DEFAULT_TENANT_ID,
  };

  const preferences = parsePreferences(profile.meta);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your profile, workflow preferences, and session."
      />
      <SettingsPanel
        email={profile.email ?? user.email}
        fullName={profile.fullName}
        role={profile.role ?? "user"}
        preferences={preferences}
      />
    </div>
  );
}
