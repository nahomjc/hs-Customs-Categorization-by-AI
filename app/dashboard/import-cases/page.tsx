import { DashButton, PageHeader } from "@/components/dashboard/ui";
import { getTenantId, listImportCases } from "@/lib/import-cases/queries";
import { ImportCasesTable } from "./ImportCasesTable";

export const dynamic = "force-dynamic";

export default async function ImportCasesPage() {
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
