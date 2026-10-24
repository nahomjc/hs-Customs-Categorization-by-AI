"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DashButton,
  DashCard,
  DashCardHeader,
  dashInputClass,
} from "@/components/dashboard/ui";

type SmsProvider = "smshub" | "sms_ethiopia";

type ChannelPublic = {
  telegramEnabled: boolean;
  telegramBotUsername: string | null;
  telegramBotTokenMasked: string | null;
  hasTelegramBotToken: boolean;
  smsEnabled: boolean;
  smsProvider: SmsProvider;
  smsEthiopiaApiKeyMasked: string | null;
  smsSmshubApiKeyMasked: string | null;
  hasSmsApiKey: boolean;
  hasSmsEthiopiaApiKey: boolean;
  hasSmsSmshubApiKey: boolean;
  authorizedStaffPhones: string[];
  webhookUrl?: string;
  smsWebhookUrl?: string;
  webhookError?: string | null;
};

export function ChannelsSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ChannelPublic | null>(null);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsProvider, setSmsProvider] = useState<SmsProvider>("smshub");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [smsSmshubApiKey, setSmsSmshubApiKey] = useState("");
  const [smsEthiopiaApiKey, setSmsEthiopiaApiKey] = useState("");
  const [staffPhones, setStaffPhones] = useState("");
  const [testTelegramChatId, setTestTelegramChatId] = useState("");
  const [testSmsPhone, setTestSmsPhone] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/channels");
      const json = (await res.json()) as ChannelPublic & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);
      setTelegramEnabled(json.telegramEnabled);
      setSmsEnabled(json.smsEnabled);
      setSmsProvider(json.smsProvider === "sms_ethiopia" ? "sms_ethiopia" : "smshub");
      setStaffPhones((json.authorizedStaffPhones ?? []).join(", "));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(setWebhook = false) {
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/channels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramEnabled,
          smsEnabled,
          smsProvider,
          telegramBotToken: telegramBotToken.trim() || undefined,
          smsSmshubApiKey: smsSmshubApiKey.trim() || undefined,
          smsEthiopiaApiKey: smsEthiopiaApiKey.trim() || undefined,
          authorizedStaffPhones: staffPhones
            .split(/[,\n]/)
            .map((p) => p.trim())
            .filter(Boolean),
          setWebhook,
        }),
      });
      const json = (await res.json()) as ChannelPublic & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setData(json);
      setTelegramBotToken("");
      setSmsSmshubApiKey("");
      setSmsEthiopiaApiKey("");
      if (json.webhookError) {
        toast.error(`Saved, but webhook failed: ${json.webhookError}`);
      } else {
        toast.success(setWebhook ? "Saved and webhook registered" : "Saved");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function testChannel(channel: "telegram" | "sms") {
    const target = channel === "telegram" ? testTelegramChatId : testSmsPhone;
    const res = await fetch("/api/dashboard/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, target, message: "Test from admin channels" }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      toast.error(json.error ?? "Test failed");
      return;
    }
    toast.success("Test sent");
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading channel settings…</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Configure Telegram and SMS (SMSHub or SMS Ethiopia) for shipment and
        assignment alerts.
      </p>

      <DashCard>
        <DashCardHeader title="Telegram" />
        <div className="space-y-4 px-5 py-5">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={telegramEnabled}
              onChange={(e) => setTelegramEnabled(e.target.checked)}
            />
            Enable Telegram notifications & staff commands
          </label>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Bot token {data?.hasTelegramBotToken ? `(${data.telegramBotTokenMasked})` : ""}
            </label>
            <input
              type="password"
              value={telegramBotToken}
              onChange={(e) => setTelegramBotToken(e.target.value)}
              placeholder="Paste new token to replace"
              className={dashInputClass}
            />
            {data?.telegramBotUsername ? (
              <p className="mt-1 text-xs text-slate-500">
                Bot: @{data.telegramBotUsername}
              </p>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            Webhook URL: <code className="text-[11px]">{data?.webhookUrl}</code>
          </p>
          <p className="text-xs text-slate-500">
            Staff commands:{" "}
            <code>/status IMP-2026-00001 customs_clearance Note…</code> ·{" "}
            <code>/statuses</code>
          </p>
          <div className="flex flex-wrap gap-2">
            <DashButton disabled={saving} onClick={() => void save(false)}>
              {saving ? "Saving…" : "Save"}
            </DashButton>
            <DashButton
              variant="secondary"
              disabled={saving}
              onClick={() => void save(true)}
            >
              Save & register webhook
            </DashButton>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={testTelegramChatId}
              onChange={(e) => setTestTelegramChatId(e.target.value)}
              placeholder="Test chat id"
              className={dashInputClass}
            />
            <DashButton
              variant="secondary"
              onClick={() => void testChannel("telegram")}
            >
              Send test
            </DashButton>
          </div>
        </div>
      </DashCard>

      <DashCard>
        <DashCardHeader title="SMS" />
        <div className="space-y-4 px-5 py-5">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={smsEnabled}
              onChange={(e) => setSmsEnabled(e.target.checked)}
            />
            Enable outbound SMS notifications
          </label>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Active provider
            </label>
            <select
              value={smsProvider}
              onChange={(e) =>
                setSmsProvider(
                  e.target.value === "sms_ethiopia" ? "sms_ethiopia" : "smshub",
                )
              }
              className={dashInputClass}
            >
              <option value="smshub">SMSHub (default)</option>
              <option value="sms_ethiopia">SMS Ethiopia (legacy)</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Test SMS and all outbound messages use the active provider.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              SMSHub API key{" "}
              {data?.hasSmsSmshubApiKey ? `(${data.smsSmshubApiKeyMasked})` : ""}
            </label>
            <input
              type="password"
              value={smsSmshubApiKey}
              onChange={(e) => setSmsSmshubApiKey(e.target.value)}
              placeholder="sk_live_… paste to replace"
              className={dashInputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              SMS Ethiopia API key{" "}
              {data?.hasSmsEthiopiaApiKey ? `(${data.smsEthiopiaApiKeyMasked})` : ""}
            </label>
            <input
              type="password"
              value={smsEthiopiaApiKey}
              onChange={(e) => setSmsEthiopiaApiKey(e.target.value)}
              placeholder="Paste legacy key to replace"
              className={dashInputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Authorized staff phones (comma-separated, 251…)
            </label>
            <textarea
              value={staffPhones}
              onChange={(e) => setStaffPhones(e.target.value)}
              rows={3}
              className={`${dashInputClass} pl-3`}
              placeholder="251911234567, 251922…"
            />
          </div>
          <p className="text-xs text-slate-500">
            Inbound STATUS commands (SMS Ethiopia only):{" "}
            <code className="text-[11px]">{data?.smsWebhookUrl}</code>
          </p>
          <p className="text-xs text-slate-500">
            SMS command:{" "}
            <code>STATUS IMP-2026-00001 customs_clearance Note…</code>
          </p>
          <DashButton disabled={saving} onClick={() => void save(false)}>
            {saving ? "Saving…" : "Save SMS settings"}
          </DashButton>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={testSmsPhone}
              onChange={(e) => setTestSmsPhone(e.target.value)}
              placeholder="Test phone 251… or 09…"
              className={dashInputClass}
            />
            <DashButton
              variant="secondary"
              onClick={() => void testChannel("sms")}
            >
              Send test
            </DashButton>
          </div>
        </div>
      </DashCard>
    </div>
  );
}
