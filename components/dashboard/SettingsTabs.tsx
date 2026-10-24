"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import {
  nextTabIndex,
  type SettingsTabDef,
  type SettingsTabId,
} from "@/lib/settings/settings-tabs";

export function settingsTabId(id: SettingsTabId) {
  return `settings-tab-${id}`;
}

export function settingsPanelId(id: SettingsTabId) {
  return `settings-panel-${id}`;
}

function TabIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const TAB_ICONS: Record<SettingsTabId, ReactNode> = {
  general: (
    <TabIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"
      />
    </TabIcon>
  ),
  channels: (
    <TabIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 8h10M7 12h6M5 4h14a1 1 0 0 1 1 1v14l-4-3H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
      />
    </TabIcon>
  ),
};

type SettingsTabsProps = {
  tabs: SettingsTabDef[];
  activeId: SettingsTabId;
  onSelect: (id: SettingsTabId) => void;
};

/**
 * Flat underline tab bar: icon + label + hint, brand-blue active state,
 * horizontally scrollable on small screens, arrow-key navigation.
 */
export function SettingsTabs({ tabs, activeId, onSelect }: SettingsTabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = nextTabIndex(event.key, index, tabs.length);
    if (target === null) return;
    event.preventDefault();
    refs.current[target]?.focus();
    onSelect(tabs[target].id);
  }

  return (
    <div className="border-b border-slate-200/40">
      <div
        role="tablist"
        aria-label="Settings sections"
        className="-mb-px flex gap-1 overflow-x-auto scrollbar-none"
      >
        {tabs.map((tab, index) => {
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[index] = el;
              }}
              id={settingsTabId(tab.id)}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={settingsPanelId(tab.id)}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`group flex shrink-0 items-center gap-3 border-b-2 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#007bff]/40 ${
                active
                  ? "border-[#007bff]/75"
                  : "border-transparent hover:border-slate-200/50"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  active
                    ? "bg-[#007bff]/10 text-[#007bff]"
                    : "bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-[#007bff]"
                }`}
              >
                {TAB_ICONS[tab.id]}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-sm font-semibold ${
                    active ? "text-[#007bff]" : "text-slate-700"
                  }`}
                >
                  {tab.label}
                </span>
                <span className="block whitespace-nowrap text-xs text-slate-500">
                  {tab.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}