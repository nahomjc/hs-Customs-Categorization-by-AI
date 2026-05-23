import { db } from "@/db";
import { documents, users } from "@/db/schema";
import { documentsUploadedByUser } from "@/lib/dashboard/document-ownership";
import { desc, eq, sql } from "drizzle-orm";

export type UserListItem = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  tenantId: string;
  createdAt: Date | null;
};

export async function listDashboardUsers(): Promise<UserListItem[]> {
  try {
    return await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        role: users.role,
        status: users.status,
        tenantId: users.tenantId,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
  } catch {
    return [];
  }
}

export async function getDashboardUserDetail(userId: string) {
  try {
    const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!row) return null;

    const docRows = await db
      .select({
        id: documents.id,
        originalFileName: documents.originalFileName,
        status: documents.status,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(documentsUploadedByUser(row))
      .orderBy(desc(documents.createdAt))
      .limit(10);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(documentsUploadedByUser(row));

    return {
      ...row,
      documentCount: countRow?.count ?? 0,
      recentDocuments: docRows,
    };
  } catch {
    return null;
  }
}
