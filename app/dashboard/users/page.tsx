import { UsersTable } from "@/components/dashboard/UsersTable";
import { listDashboardUsers } from "@/lib/dashboard/users";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await listDashboardUsers();
  return <UsersTable users={users} />;
}
