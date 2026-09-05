import type { UserRole } from "@/lib/auth/roles";
import type {
  UserListSortField,
  UserListStatusFilter,
} from "@/lib/dashboard/users-list-constants";

export type UsersFilters = {
  q: string;
  role: UserRole | "all";
  status: UserListStatusFilter;
  sort: UserListSortField;
  order: "asc" | "desc";
  page: number;
  pageSize: number;
};

export function buildUsersHref(
  filters: UsersFilters,
  patch: Partial<UsersFilters> = {},
): string {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.role !== "all") params.set("role", next.role);
  if (next.status !== "active") params.set("status", next.status);
  if (next.sort !== "createdAt") params.set("sort", next.sort);
  if (next.order !== "desc" || next.sort !== "createdAt") {
    params.set("order", next.order);
  }
  if (next.page > 1) params.set("page", String(next.page));
  if (next.pageSize !== 25) params.set("pageSize", String(next.pageSize));
  const qs = params.toString();
  return qs ? `/dashboard/users?${qs}` : "/dashboard/users";
}
