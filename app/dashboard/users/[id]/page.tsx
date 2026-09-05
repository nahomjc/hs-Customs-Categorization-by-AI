import { Breadcrumbs } from "@/components/dashboard/ui";
import { UserDetailPanel } from "@/components/dashboard/UserDetailPanel";
import { getDashboardUserDetail } from "@/lib/dashboard/users";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { getUserAuditLogs } from "@/lib/import-cases/audit-queries";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function UserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [user, session] = await Promise.all([
    getDashboardUserDetail(id),
    getSessionUserProfile(),
  ]);

  const activityLog =
    user != null ? await getUserAuditLogs(user.id, user.tenantId) : [];
  const canManageRoles = session?.profile?.role === "admin";

  if (!user) {
    return (
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Users", href: "/dashboard/users" },
            { label: "Not found" },
          ]}
        />
        <div className="landing-float-card bg-white rounded-2xl p-8 text-center">
          <p className="font-semibold text-gray-900">User not found</p>
          <p className="text-sm text-gray-500 mt-1">
            This user may have been removed.
          </p>
        </div>
      </div>
    );
  }

  const displayName = user.fullName?.trim() || user.email;

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: "Users", href: "/dashboard/users" },
          { label: displayName },
        ]}
      />
      <UserDetailPanel
        user={user}
        activityLog={activityLog}
        canManageRoles={canManageRoles}
        viewerRole={session?.profile?.role ?? null}
      />
    </div>
  );
}
