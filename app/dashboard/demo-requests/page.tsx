import { redirect } from "next/navigation";
import { DemoRequestsTable } from "@/components/dashboard/DemoRequestsTable";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  countNewDemoRequests,
  listDemoRequests,
} from "@/lib/demo-requests/queries";

export const dynamic = "force-dynamic";

export default async function DemoRequestsPage() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    redirect("/dashboard");
  }

  let items: Awaited<ReturnType<typeof listDemoRequests>>["items"] = [];
  let total = 0;
  let newCount = 0;

  try {
    const [list, fresh] = await Promise.all([
      listDemoRequests({ limit: 50, offset: 0 }),
      countNewDemoRequests(),
    ]);
    items = list.items;
    total = list.total;
    newCount = fresh;
  } catch {
    // DB not configured
  }

  return (
    <DemoRequestsTable
      initialItems={items}
      initialTotal={total}
      initialNewCount={newCount}
    />
  );
}
