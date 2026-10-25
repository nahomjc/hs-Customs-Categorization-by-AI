import { redirect } from "next/navigation";
import { SuppliersTable } from "@/components/dashboard/SuppliersTable";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getTenantId } from "@/lib/import-cases/queries";
import { listSuppliers } from "@/lib/suppliers/queries";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    redirect("/dashboard");
  }

  let items: Awaited<ReturnType<typeof listSuppliers>>["items"] = [];
  let total = 0;

  try {
    const list = await listSuppliers({
      tenantId: getTenantId(),
      limit: 50,
      offset: 0,
    });
    items = list.items;
    total = list.total;
  } catch {
    // DB not configured / migration pending
  }

  return <SuppliersTable initialItems={items} initialTotal={total} />;
}
