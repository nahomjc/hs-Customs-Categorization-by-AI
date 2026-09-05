import { normalizeEthiopiaPhone } from "./phone";

type SmsSendResult = { ok: boolean; error?: string };

export async function sendSmsEthiopia(params: {
  apiKey: string;
  phone: string;
  text: string;
}): Promise<SmsSendResult> {
  const msisdn = normalizeEthiopiaPhone(params.phone);
  if (!msisdn) {
    return { ok: false, error: "Invalid Ethiopian phone number" };
  }

  try {
    const res = await fetch("https://smsethiopia.com/api/sms/send", {
      method: "POST",
      headers: {
        KEY: params.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        msisdn,
        text: params.text,
      }),
    });

    const data = (await res.json().catch(() => null)) as {
      status?: string;
      message?: string;
    } | null;

    if (!res.ok) {
      return {
        ok: false,
        error: data?.message ?? `HTTP ${res.status}`,
      };
    }

    if (data?.status && data.status !== "success") {
      return { ok: false, error: data.message ?? "SMS send rejected" };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "SMS send failed",
    };
  }
}

/** Parse inbound SMS body: STATUS <caseNumber> <status> [note...] */
export function parseSmsStatusCommand(text: string): {
  caseNumber: string;
  status: string;
  note: string | null;
} | null {
  const trimmed = text.trim();
  const match = trimmed.match(
    /^STATUS\s+(\S+)\s+(\S+)(?:\s+([\s\S]+))?$/i,
  );
  if (!match) return null;
  return {
    caseNumber: match[1],
    status: match[2].toLowerCase(),
    note: match[3]?.trim() || null,
  };
}
