import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/ui";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { isClientRole, isStaffRole } from "@/lib/auth/roles";
import { getTenantId, listTenantUsers } from "@/lib/import-cases/queries";
import { CreateImportCaseForm } from "./CreateImportCaseForm";

export const dynamic = "force-dynamic";

export default async function NewImportCasePage() {
  const session = await getSessionUserProfile();
  if (isClientRole(session?.profile?.role)) {
    redirect("/dashboard/my-shipments");
  }
  if (!isStaffRole(session?.profile?.role)) {
    redirect("/dashboard");
  }

  const tenantId = getTenantId();
  let agents: Awaited<ReturnType<typeof listTenantUsers>> = [];

  try {
    agents = await listTenantUsers(tenantId);
  } catch {
    // DB not configured
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Create Import Case"
        description="Start a new import file for document preparation and customs classification assistance."
        breadcrumbs={[
          { label: "Import cases", href: "/dashboard/import-cases" },
          { label: "New" },
        ]}
      />
      <CreateImportCaseForm agents={agents} />
    </div>
  );
}
