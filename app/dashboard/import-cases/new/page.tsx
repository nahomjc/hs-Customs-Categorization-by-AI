import { PageHeader } from "@/components/dashboard/ui";
import { getTenantId, listTenantUsers } from "@/lib/import-cases/queries";
import { CreateImportCaseForm } from "./CreateImportCaseForm";

export const dynamic = "force-dynamic";

export default async function NewImportCasePage() {
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
      />
      <CreateImportCaseForm agents={agents} />
    </div>
  );
}
