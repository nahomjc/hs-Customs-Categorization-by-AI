import { headers } from "next/headers";

import { auth } from "@/lib/auth/better-auth";

export async function getAuthSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function getAuthUser() {
  const session = await getAuthSession();
  return session?.user ?? null;
}
