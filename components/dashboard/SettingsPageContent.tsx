"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChannelsSettingsPanel } from "@/components/dashboard/ChannelsSettingsPanel";
import { SettingsPanel } from "@/components/dashboard/SettingsPanel";
import { VddImportPanel } from "@/components/dashboard/VddImportPanel";
import type { UserPreferences } from "@/lib/auth/settings-meta";

export type SettingsTabId = "general" | "channels" | "vdd";

type TabDef = { id: SettingsTabId; label: string; adminOnly: boolean };

const TABS: TabDef[] = [
  { id: "general", label: "General", adminOnly: false },
  { id: "channels", label: "Channels", adminOnly: true },
  { id: "vdd", label: "VDD import", adminOnly: true },
];

const TAB_DESCRIPTIONS: Record<SettingsTabId, string> = {
  general:
    "Profile, notifications, workflow preferences, and session.",
  channels:
    "Telegram bot and SMS providers for shipment and assignment alerts.",
  vdd:
    "Import historical Valuation Details Declaration data from Excel.",
};

function resolveTab(raw: string | null, isAdmin: boolean): SettingsTabId {
  const match = TABS.find((t) => t.id === raw);
  if (!match) return "general";
  if (match.adminOnly && !isAdmin) return "general";
  return match.id;
}

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
  const tab = resolveTab(searchParams.get("tab"), isAdmin);
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

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
      <nav
        className="flex flex-wrap gap-1 rounded-2xl border border-slate-200/70 bg-white p-1 shadow-sm"
        aria-label="Settings sections"
      >
        {visibleTabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(t.id)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-[#007bff] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

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

      {tab === "vdd" && isAdmin ? <VddImportPanel embedded /> : null}
    </div>
  );
}

export function settingsTabDescription(
  tab: SettingsTabId,
  role: string,
): string {
  if (role === "client" && tab === "general") {
    return "Manage notification preferences and connect Telegram.";
  }
  return TAB_DESCRIPTIONS[tab];
}
