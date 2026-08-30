import { SettingsPanel } from "@/components/dashboard/SettingsPanel";
import { PageHeader } from "@/components/dashboard/ui";
import { clampPreferencesForRole } from "@/lib/auth/settings-meta";
import { canUseTenantDocumentScope } from "@/lib/settings/document-scope";
import { getUserPreferences } from "@/lib/settings/user-settings";
import { getDashboardUserDetail } from "@/lib/dashboard/users";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { getAuthUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getAuthUser();

  if (!user?.id || !user.email) {
    return null;
  }

  const row = await getDashboardUserDetail(user.id);
  const profile = row ?? {
    email: user.email,
    fullName: user.name ?? null,
    role: "user",
    meta: {},
    tenantId: DEFAULT_TENANT_ID,
  };

  const role = profile.role ?? "user";
  const preferences = clampPreferencesForRole(
    await getUserPreferences(user.id),
    role
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your profile, workflow preferences, and session."
      />
      <SettingsPanel
        email={profile.email ?? user.email}
        fullName={profile.fullName}
        role={role}
        preferences={preferences}
        canManageScope={canUseTenantDocumentScope(role)}
      />
    </div>
  );
}
