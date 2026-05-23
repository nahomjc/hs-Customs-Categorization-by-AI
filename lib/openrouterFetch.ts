const OPENROUTER_TIMEOUT_MS = 45_000;

export async function fetchOpenRouter(
  url: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("OpenRouter request timed out after 45s");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
