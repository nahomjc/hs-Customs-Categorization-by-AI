import { UsersTable } from "@/components/dashboard/UsersTable";
import { clampPreferencesForRole } from "@/lib/auth/settings-meta";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { listDashboardUsers } from "@/lib/dashboard/users";
import { getUserPreferences } from "@/lib/settings/user-settings";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [users, session] = await Promise.all([
    listDashboardUsers(),
    getSessionUserProfile(),
  ]);

  const canManageRoles = session?.profile?.role === "admin";
  const prefs =
    session?.authUser?.id != null
      ? clampPreferencesForRole(
          await getUserPreferences(session.authUser.id),
          session?.profile?.role
        )
      : { showInactiveUsers: false };

  const visibleUsers = prefs.showInactiveUsers
    ? users
    : users.filter((u) => u.status === "active");

  return (
    <UsersTable users={visibleUsers} canManageRoles={canManageRoles} />
  );
}
