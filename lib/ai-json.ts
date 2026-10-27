/**
 * Reading JSON out of an AI reply without trusting it blindly.
 *
 * A reply can be cut off (token limit, stream cut). A cut reply is never shown to
 * the user: it is retried once with a bigger limit and a stricter instruction,
 * and only a COMPLETE valid object is accepted (a safe repair may drop an unfinished
 * trailing field, it never invents one). If nothing works, an AiReplyError with a
 * plain message is thrown; the raw text stays in the server log.
 */

export class AiReplyError extends Error {
  readonly kind: "cut_off" | "unreadable";
  constructor(kind: "cut_off" | "unreadable") {
    super(
      kind === "cut_off"
        ? "The AI reply was cut off; try Ask AI again."
        : "The AI reply could not be read; try Ask AI again.",
    );
    this.name = "AiReplyError";
    this.kind = kind;
  }
}

export function stripJsonFence(content: string): string {
  return content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
}

/** A parsed JSON object, or null when the text is not one complete object. */
export function tryParseJsonObject<T>(content: string): T | null {
  try {
    const value: unknown = JSON.parse(stripJsonFence(content));
    return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : null;
  } catch {
    return null;
  }
}

/**
 * A reply that stops in the middle of a field: keep every field that is complete,
 * drop the unfinished one, and accept the result ONLY when all `requiredKeys` are
 * still there. Nothing is added or guessed. Returns null otherwise.
 */
export function repairTruncatedJson<T>(
  content: string,
  requiredKeys: readonly string[],
): T | null {
  const s = stripJsonFence(content);
  if (!s.startsWith("{")) return null;

  const accept = (text: string): T | null => {
    const obj = tryParseJsonObject<Record<string, unknown>>(text);
    if (!obj) return null;
    return requiredKeys.every((k) => k in obj) ? (obj as T) : null;
  };

  // complete fields, only the closing brace is missing
  const whole = accept(`${s.trimEnd().replace(/,\s*$/, "")}}`);
  if (whole) return whole;

  // commas that end a top-level field (outside strings, depth 1)
  const cuts: number[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;
    else if (ch === "," && depth === 1) cuts.push(i);
  }
  for (let i = cuts.length - 1; i >= 0; i--) {
    const repaired = accept(`${s.slice(0, cuts[i])}}`);
    if (repaired) return repaired;
  }
  return null;
}

export type AiCallResult = { content: string; finishReason?: string | null };
export type AiMessage = { role: "system" | "user"; content: string };

export const STRICT_JSON_SUFFIX =
  "\n\nIMPORTANT: your previous reply was cut off or was not valid JSON. Reply with ONE compact JSON object only: no markdown, no explanation. Keep every text value short (cleanDescription at most 12 words, any reason at most 20 words). Use only the fields of the format above.";

/**
 * Ask for a JSON object. Complete valid JSON is returned as is. Otherwise (cut off
 * or invalid) ask once more with `retryMaxTokens` and a shorter, stricter
 * instruction, then try a safe repair, then give up with an AiReplyError.
 */
export async function requestJsonObject<T>(
  call: (messages: AiMessage[], maxTokens: number) => Promise<AiCallResult>,
  messages: AiMessage[],
  options: {
    maxTokens: number;
    retryMaxTokens: number;
    requiredKeys: readonly string[];
    label?: string;
    log?: (message: string) => void;
  },
): Promise<{ parsed: T; content: string }> {
  const log = options.log ?? (() => undefined);
  const first = await call(messages, options.maxTokens);
  const ok = tryParseJsonObject<T>(first.content);
  if (ok) return { parsed: ok, content: first.content };

  log(
    `${options.label ?? "AI"} reply not usable (finish_reason=${first.finishReason ?? "?"}, ${first.content.length} chars): retrying once`,
  );
  const stricter = messages.map((m, i) =>
    i === 0 && m.role === "system" ? { ...m, content: m.content + STRICT_JSON_SUFFIX } : m,
  );
  if (!stricter.some((m) => m.content.endsWith(STRICT_JSON_SUFFIX))) {
    stricter.push({ role: "user", content: STRICT_JSON_SUFFIX.trim() });
  }
  const second = await call(stricter, options.retryMaxTokens);
  const ok2 = tryParseJsonObject<T>(second.content);
  if (ok2) return { parsed: ok2, content: second.content };

  const repaired =
    repairTruncatedJson<T>(second.content, options.requiredKeys) ??
    repairTruncatedJson<T>(first.content, options.requiredKeys);
  if (repaired) {
    log(`${options.label ?? "AI"} reply repaired (unfinished last field dropped)`);
    return { parsed: repaired, content: second.content || first.content };
  }

  const cutOff = first.finishReason === "length" || second.finishReason === "length";
  log(
    `${options.label ?? "AI"} reply unusable after retry (finish_reason=${second.finishReason ?? "?"}): ${second.content.slice(0, 200)}`,
  );
  throw new AiReplyError(cutOff ? "cut_off" : "unreadable");
}