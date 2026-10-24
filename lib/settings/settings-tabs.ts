export type SettingsTabId = "general" | "channels";

export type SettingsTabDef = {
  id: SettingsTabId;
  label: string;
  /** Short line shown under the label. */
  hint: string;
  adminOnly: boolean;
};

export const SETTINGS_TABS: readonly SettingsTabDef[] = [
  {
    id: "general",
    label: "General",
    hint: "Profile and preferences",
    adminOnly: false,
  },
  {
    id: "channels",
    label: "Channels",
    hint: "Telegram and SMS alerts",
    adminOnly: true,
  },
];

const TAB_DESCRIPTIONS: Record<SettingsTabId, string> = {
  general: "Profile, notifications, workflow preferences, and session.",
  channels:
    "Telegram bot and SMS providers for shipment and assignment alerts.",
};

/** Tabs a role may see, in display order. */
export function visibleSettingsTabs(isAdmin: boolean): SettingsTabDef[] {
  return SETTINGS_TABS.filter((t) => !t.adminOnly || isAdmin);
}

/** Unknown or not-allowed values fall back to General. */
export function resolveSettingsTab(
  raw: string | null | undefined,
  isAdmin: boolean,
): SettingsTabId {
  const match = SETTINGS_TABS.find((t) => t.id === raw);
  if (!match) return "general";
  if (match.adminOnly && !isAdmin) return "general";
  return match.id;
}

/** Roving-focus target for a tablist key press, or null when the key is not handled. */
export function nextTabIndex(
  key: string,
  current: number,
  count: number,
): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (current + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
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