const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function isLocalOrigin(origin: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** Production-safe app origin (server / email hook). Skips localhost env on Vercel. */
export function getAppOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : undefined;

  if (vercel) {
    if (configured && !isLocalOrigin(configured)) {
      return configured;
    }
    return vercel;
  }

  if (configured) {
    return configured;
  }

  return "http://localhost:3000";
}

/** Safe origin for auth redirect URLs in the browser (signup, password reset). */
export function getRedirectOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return getAppOrigin();
}

/**
 * Supabase passes through redirect_to from signup. If that was localhost but the
 * app runs on Vercel, use the deployed origin so confirmation links open production.
 */
export function normalizeAuthRedirectTo(
  redirectTo: string,
  appOrigin: string = getAppOrigin()
): string {
  const app = appOrigin.replace(/\/$/, "");

  try {
    const url = new URL(redirectTo);
    if (isLocalOrigin(url.origin) && !isLocalOrigin(app)) {
      const base = new URL(app);
      url.protocol = base.protocol;
      url.host = base.host;
      return url.toString();
    }
    return redirectTo;
  } catch {
    return `${app}/auth/callback?next=/dashboard`;
  }
}
