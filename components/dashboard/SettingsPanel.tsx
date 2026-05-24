"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { signOut } from "@/app/auth/actions";
import {
  DEFAULT_PREFERENCES,
  type UserPreferences,
} from "@/lib/auth/settings-meta";
import { DashCard, DashCardHeader } from "./ui";

const fieldClass =
  "w-full py-2.5 px-3 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bff] focus:ring-[3px] focus:ring-[#007bff]/12";

type SettingsPanelProps = {
  email: string;
  fullName: string | null;
  role: string;
  preferences: UserPreferences;
  /** Admins and assessors can set tenant-wide document scope. */
  canManageScope?: boolean;
};

export function SettingsPanel({
  email,
  fullName: initialName,
  role,
  preferences: initialPrefs,
  canManageScope = false,
}: SettingsPanelProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialName ?? "");
  const [prefs, setPrefs] = useState<UserPreferences>(initialPrefs);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          preferences: prefs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success("Settings saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function resetPrefs() {
    setPrefs({ ...DEFAULT_PREFERENCES });
    toast.message("Preferences reset — click Save to apply");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <form onSubmit={handleSave} className="space-y-6">
        <DashCard>
        <DashCardHeader title="Profile" />
        <div className="p-5 sm:p-6 space-y-4">
          <div>
            <label htmlFor="settings-email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              id="settings-email"
              type="email"
              value={email}
              disabled
              className={`${fieldClass} bg-gray-50 text-gray-500 cursor-not-allowed`}
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Email is managed by your login provider and cannot be changed here.
            </p>
          </div>
          <div>
            <label htmlFor="settings-name" className="block text-sm font-medium text-gray-700 mb-1.5">
              Display name
            </label>
            <input
              id="settings-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={fieldClass}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1.5">Role</span>
            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-[#007bff] capitalize">
              {role}
            </span>
          </div>
          <Link
            href="/account"
            className="inline-flex text-sm font-medium text-[#007bff] hover:underline"
          >
            View full account details →
          </Link>
        </div>
        </DashCard>

        <DashCard>
          <DashCardHeader
            title="Preferences"
            action={
              <button
                type="button"
                onClick={resetPrefs}
                className="text-xs font-medium text-gray-500 hover:text-gray-800"
              >
                Reset defaults
              </button>
            }
          />
        <div className="p-5 sm:p-6 space-y-6">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Notifications
            </p>
            <ToggleRow
              label="Email when classification completes"
              description="Receive a notification after a document finishes processing."
              checked={prefs.emailOnComplete}
              onChange={(v) => setPrefs((p) => ({ ...p, emailOnComplete: v }))}
            />
            <ToggleRow
              label="Email when processing fails"
              description="Get alerted if parsing or classification cannot finish."
              checked={prefs.emailOnFailure}
              onChange={(v) => setPrefs((p) => ({ ...p, emailOnFailure: v }))}
            />
          </div>

          <div className="space-y-5 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Upload &amp; export
            </p>
            <ToggleRow
              label="Open document after upload"
              description="Otherwise go to History after a successful upload."
              checked={prefs.autoOpenDocument}
              onChange={(v) => setPrefs((p) => ({ ...p, autoOpenDocument: v }))}
            />
            <div>
              <label
                htmlFor="export-format"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Default export format
              </label>
              <select
                id="export-format"
                value={prefs.defaultExportFormat}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    defaultExportFormat: e.target.value as "xlsx" | "csv",
                  }))
                }
                className={fieldClass}
              >
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="classification-mode"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Classification mode
              </label>
              <select
                id="classification-mode"
                value={prefs.defaultClassificationMode}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    defaultClassificationMode: e.target.value as
                      | "auto"
                      | "ai"
                      | "pre_coded",
                  }))
                }
                className={fieldClass}
              >
                <option value="auto">Auto-detect from file</option>
                <option value="ai">Always use AI classification</option>
                <option value="pre_coded">Pre-coded HS (from document)</option>
              </select>
            </div>
          </div>

          <div className="space-y-5 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Dashboard &amp; lists
            </p>
            {canManageScope && (
              <div>
                <label
                  htmlFor="document-scope"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Document visibility
                </label>
                <select
                  id="document-scope"
                  value={prefs.documentScope}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      documentScope: e.target.value as "mine" | "tenant",
                    }))
                  }
                  className={fieldClass}
                >
                  <option value="mine">Only my uploads</option>
                  <option value="tenant">All tenant documents</option>
                </select>
              </div>
            )}
            <div>
              <label
                htmlFor="history-page-size"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                History list size
              </label>
              <select
                id="history-page-size"
                value={prefs.historyPageSize}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    historyPageSize: Number(e.target.value) as 25 | 50 | 100,
                  }))
                }
                className={fieldClass}
              >
                <option value={25}>25 documents</option>
                <option value={50}>50 documents</option>
                <option value={100}>100 documents</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="analytics-range"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Default analytics range
              </label>
              <select
                id="analytics-range"
                value={prefs.defaultAnalyticsRange}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    defaultAnalyticsRange: e.target.value as
                      | "7d"
                      | "30d"
                      | "90d"
                      | "month",
                  }))
                }
                className={fieldClass}
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="month">This month</option>
              </select>
            </div>
          </div>

          {role === "admin" && (
            <div className="space-y-5 pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                User management
              </p>
              <ToggleRow
                label="Show inactive users"
                description="Include inactive accounts on the user list."
                checked={prefs.showInactiveUsers}
                onChange={(v) =>
                  setPrefs((p) => ({ ...p, showInactiveUsers: v }))
                }
              />
            </div>
          )}
        </div>
      </DashCard>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-full bg-[#007bff] text-white text-sm font-semibold hover:bg-[#0069d9] disabled:opacity-50 transition-colors shadow-md shadow-blue-500/20"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        <Link
          href="/dashboard"
          className="px-6 py-2.5 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>

      <DashCard>
        <DashCardHeader title="Session" />
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-gray-500">
            Sign out of Impact Logistics on this device.
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-full border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors shrink-0"
            >
              Sign out
            </button>
          </form>
        </div>
      </DashCard>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
          checked ? "bg-[#007bff]" : "bg-gray-200"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
