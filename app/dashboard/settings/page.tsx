import { Suspense } from "react";
import {
  SettingsPageContent,
  settingsTabDescription,
  type SettingsTabId,
} from "@/components/dashboard/SettingsPageContent";
import { PageHeader } from "@/components/dashboard/ui";
import { clampPreferencesForRole } from "@/lib/auth/settings-meta";
import { canUseTenantDocumentScope } from "@/lib/settings/document-scope";
import { getUserPreferences } from "@/lib/settings/user-settings";
import { getDashboardUserDetail } from "@/lib/dashboard/users";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { getAuthUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function resolveTabFromParam(
  raw: string | undefined,
  isAdmin: boolean,
): SettingsTabId {
  if (raw === "channels" && isAdmin) return "channels";
  if (raw === "vdd" && isAdmin) return "vdd";
  return "general";
}

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function SettingsPage({ searchParams }: PageProps) {
  const user = await getAuthUser();

  if (!user?.id || !user.email) {
    return null;
  }

  const { tab: tabParam } = await searchParams;

  const row = await getDashboardUserDetail(user.id);
  const profile = row ?? {
    email: user.email,
    fullName: user.name ?? null,
    role: "user",
    meta: {},
    tenantId: DEFAULT_TENANT_ID,
  };

  const role = profile.role ?? "user";
  const isAdmin = role === "admin";
  const activeTab = resolveTabFromParam(tabParam, isAdmin);
  const preferences = clampPreferencesForRole(
    await getUserPreferences(user.id),
    role,
  );

  return (
    <div className="w-full min-w-0 space-y-8">
      <PageHeader
        title="Settings"
        description={settingsTabDescription(activeTab, role)}
      />
      <Suspense
        fallback={
          <p className="text-sm text-slate-500">Loading settings…</p>
        }
      >
        <SettingsPageContent
          email={profile.email ?? user.email}
          fullName={profile.fullName}
          role={role}
          preferences={preferences}
          canManageScope={canUseTenantDocumentScope(role)}
          isAdmin={isAdmin}
        />
      </Suspense>
    </div>
  );
}
