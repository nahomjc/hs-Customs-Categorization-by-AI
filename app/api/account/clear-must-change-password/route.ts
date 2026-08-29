import { headers } from "next/headers";

import { clearMustChangePassword } from "@/lib/auth/password-policy";
import { getAuthUser } from "@/lib/auth/session";

export async function POST() {
  const user = await getAuthUser();
  if (!user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await clearMustChangePassword(user.id);
  return Response.json({ ok: true });
}
