import { redirect } from "next/navigation";
import { InviteUserForm } from "@/components/dashboard/InviteUserForm";
import { requireAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function InviteUserPage() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    redirect("/dashboard/users");
  }
  return <InviteUserForm />;
}
