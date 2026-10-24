import { redirect } from "next/navigation";
import { UsersTable } from "@/components/dashboard/UsersTable";
import { canManageUsers } from "@/lib/auth/permissions";
import { getSessionUserProfile, requireAdminOrAssessor } from "@/lib/auth/require-admin";
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
  const access = await requireAdminOrAssessor();
  if (!access.ok) {
    redirect("/dashboard");
  }

  const raw = await searchParams;
  const filters = parseUsersListSearchParams(raw);

  const [result, session] = await Promise.all([
    listDashboardUsers(filters),
    getSessionUserProfile(),
  ]);

  const canManageRoles = canManageUsers(session?.profile?.role);

  return (
    <UsersTable
      result={result}
      filters={filters}
      canManageRoles={canManageRoles}
    />
  );
}
