import { redirect } from "next/navigation";
import { HsReferencePanel } from "@/components/dashboard/HsReferencePanel";
import { requireAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function HsReferencePage() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    redirect("/dashboard");
  }

  return <HsReferencePanel />;
}
