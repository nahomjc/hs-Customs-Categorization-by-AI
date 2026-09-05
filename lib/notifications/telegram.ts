type TelegramSendResult = { ok: boolean; error?: string };

export async function sendTelegramMessage(params: {
  botToken: string;
  chatId: string;
  text: string;
}): Promise<TelegramSendResult> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${params.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: params.chatId,
          text: params.text,
          disable_web_page_preview: true,
        }),
      },
    );
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Telegram send failed",
    };
  }
}

export async function setTelegramWebhook(params: {
  botToken: string;
  url: string;
  secretToken: string;
}): Promise<TelegramSendResult> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${params.botToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: params.url,
          secret_token: params.secretToken,
          allowed_updates: ["message"],
          drop_pending_updates: true,
        }),
      },
    );
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "setWebhook failed",
    };
  }
}

export async function getTelegramBotUsername(
  botToken: string,
): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = (await res.json()) as {
      ok?: boolean;
      result?: { username?: string };
    };
    if (!data.ok) return null;
    return data.result?.username ?? null;
  } catch {
    return null;
  }
}

export type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: string;
    chat?: { id?: number | string; type?: string };
    from?: { id?: number; username?: string; first_name?: string };
  };
};

export function parseTelegramCommand(text: string): {
  command: string;
  args: string[];
} {
  const trimmed = text.trim();
  const withoutMention = trimmed.replace(/^\/(\w+)(?:@\w+)?/i, "/$1");
  const parts = withoutMention.split(/\s+/).filter(Boolean);
  const command = (parts[0] ?? "").toLowerCase();
  return { command, args: parts.slice(1) };
}
