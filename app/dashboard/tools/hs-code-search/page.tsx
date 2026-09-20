import { redirect } from "next/navigation";
import { HsCodeSearchPanel } from "@/components/dashboard/HsCodeSearchPanel";
import { requireAdminOrAssessor } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function HsCodeSearchPage() {
  const access = await requireAdminOrAssessor();
  if (!access.ok) {
    redirect("/dashboard");
  }

  return <HsCodeSearchPanel />;
}
