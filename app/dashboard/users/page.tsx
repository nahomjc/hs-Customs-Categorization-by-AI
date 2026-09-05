import { UsersTable } from "@/components/dashboard/UsersTable";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import {
  listDashboardUsers,
  parseUsersListSearchParams,
} from "@/lib/dashboard/users";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
    sort?: string;
    order?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function UsersPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = parseUsersListSearchParams(raw);

  const [result, session] = await Promise.all([
    listDashboardUsers(filters),
    getSessionUserProfile(),
  ]);

  const canManageRoles = session?.profile?.role === "admin";

  return (
    <UsersTable
      result={result}
      filters={filters}
      canManageRoles={canManageRoles}
    />
  );
}
