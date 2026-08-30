import Link from "next/link";
import { UserDetailPanel } from "@/components/dashboard/UserDetailPanel";
import { PageHeader } from "@/components/dashboard/ui";
import { getDashboardUserDetail } from "@/lib/dashboard/users";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { getAuthUser } from "@/lib/auth/session";
import { getUserAuditLogs } from "@/lib/import-cases/audit-queries";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const authUser = await getAuthUser();

  if (!authUser?.id || !authUser.email) {
    return null;
  }

  const profile =
    (await getDashboardUserDetail(authUser.id)) ?? {
      id: authUser.id,
      tenantId: DEFAULT_TENANT_ID,
      email: authUser.email,
      fullName: authUser.name ?? null,
      avatarUrl: authUser.image ?? null,
      role: "user",
      status: "active",
      meta: {},
      createdAt: new Date(authUser.createdAt),
      updatedAt: new Date(authUser.updatedAt),
      documentCount: 0,
      recentDocuments: [],
    };

  const activityLog = await getUserAuditLogs(profile.id, profile.tenantId);

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-[#007bff] hover:underline font-medium"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <title>Back to dashboard</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to dashboard
      </Link>

      <PageHeader
        title="My account"
        description="Your profile, role, and recent document activity."
      />

      <UserDetailPanel user={profile} variant="self" activityLog={activityLog} />
    </div>
  );
}
