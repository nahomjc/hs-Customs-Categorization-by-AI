"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChannelsSettingsPanel } from "@/components/dashboard/ChannelsSettingsPanel";
import { SettingsPanel } from "@/components/dashboard/SettingsPanel";
import {
  SettingsTabs,
  settingsPanelId,
  settingsTabId,
} from "@/components/dashboard/SettingsTabs";
import type { UserPreferences } from "@/lib/auth/settings-meta";
import {
  resolveSettingsTab,
  visibleSettingsTabs,
  type SettingsTabId,
} from "@/lib/settings/settings-tabs";

type SettingsPageContentProps = {
  email: string;
  fullName: string | null;
  role: string;
  preferences: UserPreferences;
  canManageScope: boolean;
  isAdmin: boolean;
};

export function SettingsPageContent({
  email,
  fullName,
  role,
  preferences,
  canManageScope,
  isAdmin,
}: SettingsPageContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = resolveSettingsTab(searchParams.get("tab"), isAdmin);
  const visibleTabs = visibleSettingsTabs(isAdmin);

  function selectTab(id: SettingsTabId) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "general") {
      params.delete("tab");
    } else {
      params.set("tab", id);
    }
    const qs = params.toString();
    router.push(qs ? `/dashboard/settings?${qs}` : "/dashboard/settings", {
      scroll: false,
    });
  }

  return (
    <div className="space-y-6">
      {visibleTabs.length > 1 ? (
        <SettingsTabs
          tabs={visibleTabs}
          activeId={tab}
          onSelect={selectTab}
        />
      ) : null}

      <div
        role={visibleTabs.length > 1 ? "tabpanel" : undefined}
        id={settingsPanelId(tab)}
        aria-labelledby={
          visibleTabs.length > 1 ? settingsTabId(tab) : undefined
        }
      >
        {tab === "general" ? (
          <SettingsPanel
            email={email}
            fullName={fullName}
            role={role}
            preferences={preferences}
            canManageScope={canManageScope}
          />
        ) : null}

        {tab === "channels" && isAdmin ? <ChannelsSettingsPanel /> : null}
      </div>
    </div>
  );
}