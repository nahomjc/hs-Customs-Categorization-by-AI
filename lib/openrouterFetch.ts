const OPENROUTER_TIMEOUT_MS = 45_000;

export async function fetchOpenRouter(
  url: string,
  init: RequestInit,
  /** Override the default 45s timeout (web-search calls are slower). */
  timeoutMs: number = OPENROUTER_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        `OpenRouter request timed out after ${Math.round(timeoutMs / 1000)}s`
      );
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}