import { toSmsHubMsisdn } from "./phone";

type SmsSendResult = { ok: boolean; error?: string };

export async function sendSmsSmshub(params: {
  apiKey: string;
  phone: string;
  text: string;
}): Promise<SmsSendResult> {
  const msisdn = toSmsHubMsisdn(params.phone);
  if (!msisdn) {
    return { ok: false, error: "Invalid Ethiopian phone number" };
  }

  try {
    const res = await fetch("https://smshub.et/api/sms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        msisdn,
        text: params.text,
      }),
    });

    const data = (await res.json().catch(() => null)) as {
      message?: string;
      error_type?: string;
    } | null;

    if (!res.ok) {
      return {
        ok: false,
        error: data?.message ?? `HTTP ${res.status}`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "SMS send failed",
    };
  }
}
