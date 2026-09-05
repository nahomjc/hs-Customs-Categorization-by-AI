import { db } from "@/db";
import { documents, users } from "@/db/schema";
import { documentsUploadedByUser } from "@/lib/dashboard/document-ownership";
import { isUserRole, type UserRole } from "@/lib/auth/roles";
import {
  USER_LIST_PAGE_SIZES,
  USER_LIST_SORT_FIELDS,
  type UserListSortField,
  type UserListStatusFilter,
} from "@/lib/dashboard/users-list-constants";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

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

export {
  USER_LIST_PAGE_SIZES,
  USER_LIST_SORT_FIELDS,
  type UserListSortField,
  type UserListStatusFilter,
};
export type ListDashboardUsersParams = {
  q?: string;
  role?: UserRole | "all";
  status?: UserListStatusFilter;
  sort?: UserListSortField;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type ListDashboardUsersResult = {
  items: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function parseSortField(value: string | undefined): UserListSortField {
  if (
    value &&
    (USER_LIST_SORT_FIELDS as readonly string[]).includes(value)
  ) {
    return value as UserListSortField;
  }
  return "createdAt";
}

export function parseUsersListSearchParams(raw: {
  q?: string;
  role?: string;
  status?: string;
  sort?: string;
  order?: string;
  page?: string;
  pageSize?: string;
}): Required<
  Pick<ListDashboardUsersParams, "page" | "pageSize" | "sort" | "order">
> & {
  q: string;
  role: UserRole | "all";
  status: UserListStatusFilter;
} {
  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);
  const pageSizeRaw = Number.parseInt(raw.pageSize ?? "25", 10) || 25;
  const pageSize = (USER_LIST_PAGE_SIZES as readonly number[]).includes(
    pageSizeRaw,
  )
    ? pageSizeRaw
    : 25;

  const role =
    raw.role && isUserRole(raw.role) ? raw.role : ("all" as const);

  const status: UserListStatusFilter =
    raw.status === "inactive" || raw.status === "all" || raw.status === "active"
      ? raw.status
      : "active";

  return {
    q: (raw.q ?? "").trim(),
    role,
    status,
    sort: parseSortField(raw.sort),
    order: raw.order === "asc" ? "asc" : "desc",
    page,
    pageSize,
  };
}

export async function listDashboardUsers(
  params: ListDashboardUsersParams = {},
): Promise<ListDashboardUsersResult> {
  const q = params.q?.trim() ?? "";
  const role = params.role && params.role !== "all" ? params.role : null;
  const status =
    params.status === "all" ? null : (params.status ?? "active");
  const sort = parseSortField(params.sort);
  const order = params.order === "asc" ? "asc" : "desc";
  const page = Math.max(1, params.page ?? 1);
  const pageSizeRaw = params.pageSize ?? 25;
  const pageSize = (USER_LIST_PAGE_SIZES as readonly number[]).includes(
    pageSizeRaw,
  )
    ? pageSizeRaw
    : 25;

  const conditions: SQL[] = [];

  if (status) {
    conditions.push(eq(users.status, status));
  }
  if (role) {
    conditions.push(eq(users.role, role));
  }
  if (q) {
    const term = `%${q}%`;
    conditions.push(
      or(
        ilike(users.fullName, term),
        ilike(users.email, term),
        ilike(users.phone, term),
      )!,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn = {
    createdAt: users.createdAt,
    fullName: users.fullName,
    email: users.email,
    role: users.role,
    status: users.status,
  }[sort];

  const orderBy = order === "asc" ? asc(sortColumn) : desc(sortColumn);

  try {
    const [totalRow] = await db.select({ count: count() }).from(users).where(where);
    const total = totalRow?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;

    const items = await db
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
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset);

    return {
      items,
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  } catch {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 1,
    };
  }
}

/** @deprecated Prefer listDashboardUsers with params; kept for simple callers. */
export async function listAllDashboardUsers(): Promise<UserListItem[]> {
  const result = await listDashboardUsers({
    status: "all",
    page: 1,
    pageSize: 100,
  });
  return result.items;
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
