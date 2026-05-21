export const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID ?? "default-tenant";

export const AUTH_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
] as const;

export { getAppOrigin } from "@/lib/auth/redirect-origin";
