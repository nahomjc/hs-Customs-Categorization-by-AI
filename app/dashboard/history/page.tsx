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
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
          History
        </h1>
        <p className="mt-1 text-[var(--foreground)]/70">
          All uploaded packing lists and their processing status.
        </p>
      </div>

      <HistoryTable list={list} />
    </div>
  );
}
