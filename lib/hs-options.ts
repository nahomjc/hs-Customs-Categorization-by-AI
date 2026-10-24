/**
 * Ranked HS code options and the one clarifying question, as returned by the
 * AI / web search. Pure helpers: the codes are only *proposals* here; they are
 * validated against the tariff book before anything is shown or stored.
 */

export type RawHsOption = { hsCode: string; reason?: string };

export const MAX_OPTIONS = 3;
const MAX_REASON = 200;
const MAX_QUESTION = 200;

/** Accepts `[{hsCode, reason}]` (or plain strings); keeps the model's ranking. */
export function parseOptions(raw: unknown, max = MAX_OPTIONS): RawHsOption[] {
  if (!Array.isArray(raw)) return [];
  const out: RawHsOption[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    let code: unknown;
    let reason: unknown;
    if (typeof item === "string") {
      code = item;
    } else if (item && typeof item === "object") {
      const o = item as { hsCode?: unknown; code?: unknown; reason?: unknown };
      code = o.hsCode ?? o.code;
      reason = o.reason;
    }
    if (typeof code !== "string") continue;
    const clean = code.trim();
    const key = clean.replace(/\D/g, "");
    if (!clean || key.length < 4 || seen.has(key)) continue;
    seen.add(key);
    out.push({
      hsCode: clean,
      reason:
        typeof reason === "string" && reason.trim()
          ? reason.trim().slice(0, MAX_REASON)
          : undefined,
    });
    if (out.length >= max) break;
  }
  return out;
}

/** One short question for the reviewer, or undefined. */
export function parseQuestion(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const q = raw.replace(/\s+/g, " ").trim();
  if (q.length < 5) return undefined;
  return q.slice(0, MAX_QUESTION);
}