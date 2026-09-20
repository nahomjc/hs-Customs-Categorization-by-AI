import { redirect } from "next/navigation";
import { VddImportPanel } from "@/components/dashboard/VddImportPanel";
import { requireAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function VddSettingsPage() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    redirect("/dashboard/settings");
  }

  return <VddImportPanel />;
}
