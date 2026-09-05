import { PageHeader } from "@/components/dashboard/ui";
import { AccountProfilePanel } from "@/components/account/AccountProfilePanel";
import { getDashboardUserDetail } from "@/lib/dashboard/users";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { getAuthUser } from "@/lib/auth/session";

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
      phone: null,
      emailVerified: false,
      phoneVerified: false,
      role: "user",
      status: "active",
    };

  return (
    <div className="space-y-8">
      <PageHeader
        title="My account"
        description="Update your profile photo, name, and password."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My account" },
        ]}
      />

      <AccountProfilePanel
        email={profile.email}
        fullName={profile.fullName}
        avatarUrl={profile.avatarUrl}
        role={profile.role}
        phone={profile.phone ?? null}
      />
    </div>
  );
}
