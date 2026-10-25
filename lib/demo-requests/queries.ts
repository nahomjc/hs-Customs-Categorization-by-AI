import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { demoRequests } from "@/db/schema";
import {
  type DemoRequestStatus,
  isDemoRequestStatus,
} from "@/lib/demo-requests/constants";

export type DemoRequestListItem = {
  id: string;
  fullName: string;
  email: string;
  company: string;
  phone: string | null;
  jobTitle: string | null;
  monthlyVolume: string | null;
  message: string | null;
  status: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function listDemoRequests(params: {
  search?: string;
  status?: DemoRequestStatus | "";
  limit?: number;
  offset?: number;
}): Promise<{ items: DemoRequestListItem[]; total: number }> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);
  const conditions = [];

  if (params.status && isDemoRequestStatus(params.status)) {
    conditions.push(eq(demoRequests.status, params.status));
  }

  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    const searchClause = or(
      ilike(demoRequests.fullName, term),
      ilike(demoRequests.email, term),
      ilike(demoRequests.company, term),
      ilike(demoRequests.phone, term),
    );
    if (searchClause) conditions.push(searchClause);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: demoRequests.id,
        fullName: demoRequests.fullName,
        email: demoRequests.email,
        company: demoRequests.company,
        phone: demoRequests.phone,
        jobTitle: demoRequests.jobTitle,
        monthlyVolume: demoRequests.monthlyVolume,
        message: demoRequests.message,
        status: demoRequests.status,
        source: demoRequests.source,
        createdAt: demoRequests.createdAt,
        updatedAt: demoRequests.updatedAt,
      })
      .from(demoRequests)
      .where(where)
      .orderBy(desc(demoRequests.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(demoRequests).where(where),
  ]);

  return {
    items: rows,
    total: totalRow[0]?.count ?? 0,
  };
}

export async function updateDemoRequestStatus(
  id: string,
  status: DemoRequestStatus,
): Promise<DemoRequestListItem | null> {
  const [row] = await db
    .update(demoRequests)
    .set({
      status,
      updatedAt: sql`now()`,
    })
    .where(eq(demoRequests.id, id))
    .returning({
      id: demoRequests.id,
      fullName: demoRequests.fullName,
      email: demoRequests.email,
      company: demoRequests.company,
      phone: demoRequests.phone,
      jobTitle: demoRequests.jobTitle,
      monthlyVolume: demoRequests.monthlyVolume,
      message: demoRequests.message,
      status: demoRequests.status,
      source: demoRequests.source,
      createdAt: demoRequests.createdAt,
      updatedAt: demoRequests.updatedAt,
    });

  return row ?? null;
}

export async function countNewDemoRequests(): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(demoRequests)
    .where(eq(demoRequests.status, "new"));
  return row?.count ?? 0;
}
