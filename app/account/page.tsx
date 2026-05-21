import Link from "next/link";
import { UserDetailPanel } from "@/components/dashboard/UserDetailPanel";
import { PageHeader } from "@/components/dashboard/ui";
import { getDashboardUserDetail } from "@/lib/dashboard/users";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id || !authUser.email) {
    return null;
  }

  const profile =
    (await getDashboardUserDetail(authUser.id)) ?? {
      id: authUser.id,
      tenantId: DEFAULT_TENANT_ID,
      email: authUser.email,
      fullName:
        (authUser.user_metadata?.full_name as string | undefined) ??
        (authUser.user_metadata?.name as string | undefined) ??
        null,
      avatarUrl: (authUser.user_metadata?.avatar_url as string | undefined) ?? null,
      role: "user",
      status: "active",
      meta: {},
      createdAt: authUser.created_at
        ? new Date(authUser.created_at)
        : new Date(0),
      updatedAt: authUser.updated_at
        ? new Date(authUser.updated_at)
        : authUser.created_at
          ? new Date(authUser.created_at)
          : new Date(0),
      documentCount: 0,
      recentDocuments: [],
    };

  const lastSignIn = authUser.last_sign_in_at
    ? new Date(authUser.last_sign_in_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

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

      {lastSignIn ? (
        <p className="text-sm text-gray-500 -mt-4">
          Last sign in: <span className="text-gray-700">{lastSignIn}</span>
        </p>
      ) : null}

      <UserDetailPanel user={profile} variant="self" />
    </div>
  );
}
