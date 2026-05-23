import { UsersTable } from "@/components/dashboard/UsersTable";
import { listDashboardUsers } from "@/lib/dashboard/users";
import { getSessionUserProfile } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [users, session] = await Promise.all([
    listDashboardUsers(),
    getSessionUserProfile(),
  ]);

  const canManageRoles = session?.profile?.role === "admin";

  return <UsersTable users={users} canManageRoles={canManageRoles} />;
}
