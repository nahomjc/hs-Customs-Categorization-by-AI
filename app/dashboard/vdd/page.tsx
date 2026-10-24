import { redirect } from "next/navigation";
import { VddImportPanel } from "@/components/dashboard/VddImportPanel";
import { requireAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

/** VDD import has its own page (admin only), linked from the sidebar. */
export default async function VddPage() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    redirect("/dashboard");
  }

  return <VddImportPanel />;
}