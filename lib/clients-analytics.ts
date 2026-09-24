import { db } from "@/db";
import { importCases, users } from "@/db/schema";
import { and, desc, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";

export type ClientAnalyticsRow = {
  id: string;
  fullName: string | null;
  email: string;
  status: string;
  createdAt: Date;
  casesInRange: number;
  completedCases: number;
  inProgressCases: number;
  lastCaseAt: Date | null;
  invoiceTotalSum: number;
};

export type ClientsAnalyticsData = {
  totalClients: number;
  activeClientsInRange: number;
  newClientsInRange: number;
  clientsWithCases: number;
  clientsWithoutCases: number;
  casesWithClient: number;
  casesWithoutClient: number;
  totalInvoiceValue: number;
  avgCasesPerActiveClient: number;
  topClients: ClientAnalyticsRow[];
  clientsByDay: { day: string; count: number }[];
  recentClients: {
    id: string;
    fullName: string | null;
    email: string;
    status: string;
    createdAt: Date;
    casesInRange: number;
  }[];
};

const EMPTY: ClientsAnalyticsData = {
  totalClients: 0,
  activeClientsInRange: 0,
  newClientsInRange: 0,
  clientsWithCases: 0,
  clientsWithoutCases: 0,
  casesWithClient: 0,
  casesWithoutClient: 0,
  totalInvoiceValue: 0,
  avgCasesPerActiveClient: 0,
  topClients: [],
  clientsByDay: [],
  recentClients: [],
};

function dayAfter(to: Date): Date {
  const d = new Date(to);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d;
}

const clientRoleFilter = and(
  eq(users.role, "client"),
  eq(users.status, "active"),
);

export async function fetchClientsAnalytics(
  tenantId: string,
  from?: Date,
  to?: Date,
): Promise<ClientsAnalyticsData> {
  const tenantFilter = eq(users.tenantId, tenantId);
  const clientsFilter = and(tenantFilter, clientRoleFilter);
  const caseTenantFilter = eq(importCases.tenantId, tenantId);
  const caseRangeFilter =
    from && to
      ? and(
          caseTenantFilter,
          gte(importCases.createdAt, from),
          lt(importCases.createdAt, dayAfter(to)),
        )
      : caseTenantFilter;
  const newClientsRangeFilter =
    from && to
      ? and(
          clientsFilter,
          gte(users.createdAt, from),
          lt(users.createdAt, dayAfter(to)),
        )
      : clientsFilter;

  try {
    const [
      totalClientsResult,
      newClientsResult,
      casesWithClientResult,
      casesWithoutClientResult,
      invoiceValueResult,
      clientsJoinedRows,
      clientsByDayRows,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(clientsFilter),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(newClientsRangeFilter),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(importCases)
        .where(and(caseRangeFilter, isNotNull(importCases.clientUserId))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(importCases)
        .where(and(caseRangeFilter, isNull(importCases.clientUserId))),
      db
        .select({
          sum: sql<string | null>`coalesce(sum(${importCases.invoiceTotalAmount}::numeric), 0)`,
        })
        .from(importCases)
        .where(and(caseRangeFilter, isNotNull(importCases.clientUserId))),
      db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          status: users.status,
          createdAt: users.createdAt,
          casesInRange: sql<number>`count(${importCases.id})::int`,
          completedCases: sql<number>`count(${importCases.id}) filter (where ${importCases.status} = 'completed')::int`,
          inProgressCases: sql<number>`count(${importCases.id}) filter (where ${importCases.status} not in ('completed', 'cancelled'))::int`,
          lastCaseAt: sql<Date | null>`max(${importCases.createdAt})`,
          invoiceTotalSum: sql<string>`coalesce(sum(${importCases.invoiceTotalAmount}::numeric), 0)`,
        })
        .from(users)
        .leftJoin(
          importCases,
          and(
            eq(importCases.clientUserId, users.id),
            caseRangeFilter,
          ),
        )
        .where(clientsFilter)
        .groupBy(
          users.id,
          users.fullName,
          users.email,
          users.status,
          users.createdAt,
        )
        .orderBy(
          desc(sql`count(${importCases.id})`),
          users.fullName,
        ),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(users)
        .where(
          from && to
            ? newClientsRangeFilter
            : and(
                clientsFilter,
                sql`${users.createdAt} >= now() - interval '30 days'`,
              ),
        )
        .groupBy(sql`date_trunc('day', ${users.createdAt})`)
        .orderBy(sql`date_trunc('day', ${users.createdAt})`),
    ]);

    const clientRows: ClientAnalyticsRow[] = clientsJoinedRows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      email: r.email,
      status: r.status,
      createdAt: r.createdAt,
      casesInRange: r.casesInRange,
      completedCases: r.completedCases,
      inProgressCases: r.inProgressCases,
      lastCaseAt: r.lastCaseAt,
      invoiceTotalSum: Number(r.invoiceTotalSum) || 0,
    }));

    const activeClientsInRange = clientRows.filter((c) => c.casesInRange > 0)
      .length;
    const clientsWithCases = clientRows.filter((c) => c.casesInRange > 0)
      .length;
    const totalClients = totalClientsResult[0]?.count ?? 0;
    const casesWithClient = casesWithClientResult[0]?.count ?? 0;

    return {
      totalClients,
      activeClientsInRange,
      newClientsInRange: newClientsResult[0]?.count ?? 0,
      clientsWithCases,
      clientsWithoutCases: Math.max(0, totalClients - clientsWithCases),
      casesWithClient,
      casesWithoutClient: casesWithoutClientResult[0]?.count ?? 0,
      totalInvoiceValue: Number(invoiceValueResult[0]?.sum ?? 0) || 0,
      avgCasesPerActiveClient:
        activeClientsInRange > 0
          ? Math.round((casesWithClient / activeClientsInRange) * 10) / 10
          : 0,
      topClients: clientRows.filter((c) => c.casesInRange > 0).slice(0, 8),
      clientsByDay: clientsByDayRows.map((r) => ({
        day: r.day,
        count: r.count,
      })),
      recentClients: clientRows.slice(0, 12).map((c) => ({
        id: c.id,
        fullName: c.fullName,
        email: c.email,
        status: c.status,
        createdAt: c.createdAt,
        casesInRange: c.casesInRange,
      })),
    };
  } catch {
    return EMPTY;
  }
}
