import { PageHeader } from "@/components/dashboard/ui";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { desc } from "drizzle-orm";
import { HistoryTable } from "./HistoryTable";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  let list: {
    id: string;
    originalFileName: string | null;
    status: string | null;
    createdAt: Date | null;
  }[] = [];
  try {
    list = await db
      .select({
        id: documents.id,
        originalFileName: documents.originalFileName,
        status: documents.status,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .orderBy(desc(documents.createdAt));
  } catch {
    // DB not configured
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="History"
        description="All uploaded packing lists and their processing status."
      />
      <HistoryTable list={list} />
    </div>
  );
}
