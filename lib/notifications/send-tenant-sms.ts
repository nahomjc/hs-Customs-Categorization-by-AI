import {
  type ChannelSettings,
  getTenantChannelSettings,
  type SmsProvider,
} from "@/lib/notifications/channel-settings";
import { sendSmsEthiopia } from "@/lib/notifications/sms-ethiopia";
import { sendSmsSmshub } from "@/lib/notifications/sms-smshub";

type SmsSendResult = { ok: boolean; error?: string };

export function activeSmsApiKey(settings: ChannelSettings): string | null {
  if (settings.smsProvider === "sms_ethiopia") {
    return settings.smsEthiopiaApiKey;
  }
  return settings.smsSmshubApiKey;
}

export function hasConfiguredSms(settings: ChannelSettings): boolean {
  return Boolean(activeSmsApiKey(settings));
}

export async function sendTenantSms(params: {
  tenantId: string;
  phone: string;
  text: string;
  settings?: ChannelSettings;
}): Promise<SmsSendResult> {
  const settings = params.settings ?? await getTenantChannelSettings(params.tenantId);

  if (!settings.smsEnabled) {
    return { ok: false, error: "SMS disabled" };
  }

  const apiKey = activeSmsApiKey(settings);
  if (!apiKey) {
    const label =
      settings.smsProvider === "sms_ethiopia" ? "SMS Ethiopia" : "SMSHub";
    return { ok: false, error: `${label} API key not configured` };
  }

  if (settings.smsProvider === "sms_ethiopia") {
    return sendSmsEthiopia({
      apiKey,
      phone: params.phone,
      text: params.text,
    });
  }

  return sendSmsSmshub({
    apiKey,
    phone: params.phone,
    text: params.text,
  });
}

export function isSmsProvider(value: string): value is SmsProvider {
  return value === "smshub" || value === "sms_ethiopia";
}
