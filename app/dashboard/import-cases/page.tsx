import { redirect } from "next/navigation";
import { DashButton, PageHeader } from "@/components/dashboard/ui";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { isClientRole, isStaffRole } from "@/lib/auth/roles";
import { getTenantId, listImportCases } from "@/lib/import-cases/queries";
import { ImportCasesTable } from "./ImportCasesTable";

export const dynamic = "force-dynamic";

export default async function ImportCasesPage() {
  const session = await getSessionUserProfile();
  if (isClientRole(session?.profile?.role)) {
    redirect("/dashboard/my-shipments");
  }
  if (!isStaffRole(session?.profile?.role)) {
    redirect("/dashboard");
  }

  const tenantId = getTenantId();
  let items: Awaited<ReturnType<typeof listImportCases>>["items"] = [];
  let total = 0;

  try {
    const result = await listImportCases({
      tenantId,
      limit: 50,
      offset: 0,
    });
    items = result.items;
    total = result.total;
  } catch {
    // DB not configured
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Import Cases"
        description="Manage Ethiopian import document preparation and customs classification assistance."
        action={
          <DashButton href="/dashboard/import-cases/new">
            Create import case
          </DashButton>
        }
      />
      <ImportCasesTable initialItems={items} initialTotal={total} />
    </div>
  );
}
