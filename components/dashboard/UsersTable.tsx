import Link from "next/link";
import { applyUsersListFilters } from "@/app/dashboard/users/actions";
import {
  DashCard,
  DashTable,
  DashTableAction,
  DashTableEmpty,
  DashTableFooter,
  DashTableHead,
  DashTableHeaderRow,
  DashTableToolbar,
  DashTbody,
  DashTd,
  DashTh,
  DashTr,
  PageHeader,
} from "@/components/dashboard/ui";
import { UserRoleSelect } from "@/components/dashboard/UserRoleSelect";
import { UsersPageSizeSelect } from "@/components/dashboard/UsersPageSizeSelect";
import { USER_ROLE_LABELS, USER_ROLES } from "@/lib/auth/roles";
import type { ListDashboardUsersResult } from "@/lib/dashboard/users";
import type { UserListSortField } from "@/lib/dashboard/users-list-constants";
import {
  buildUsersHref,
  type UsersFilters,
} from "@/lib/dashboard/users-list-href";

function getInitials(name: string | null, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusPill({ status }: { status: string }) {
  const styles =
    status === "active"
      ? "bg-emerald-100 text-emerald-800"
      : status === "inactive"
        ? "bg-gray-100 text-gray-600"
        : "bg-amber-100 text-amber-800";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${styles}`}
    >
      {status}
    </span>
  );
}

type UsersTableProps = {
  result: ListDashboardUsersResult;
  filters: UsersFilters;
  canManageRoles?: boolean;
};

function SortHeader({
  label,
  field,
  filters,
}: {
  label: string;
  field: UserListSortField;
  filters: UsersFilters;
}) {
  const active = filters.sort === field;
  const nextOrder =
    active && filters.order === "asc" ? "desc" : active ? "asc" : "asc";
  const href = buildUsersHref(filters, {
    sort: field,
    order: active ? nextOrder : "asc",
    page: 1,
  });

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 hover:text-gray-800 ${
        active ? "text-gray-900" : "text-gray-500"
      }`}
    >
      {label}
      <span className="text-[10px] font-normal" aria-hidden>
        {active ? (filters.order === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </Link>
  );
}

const fieldClass =
  "w-full py-2 px-3 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bff] focus:ring-[3px] focus:ring-[#007bff]/12";

const hasActiveFilters = (filters: UsersFilters) =>
  Boolean(filters.q) ||
  filters.role !== "all" ||
  filters.status !== "active";

export function UsersTable({
  result,
  filters,
  canManageRoles = false,
}: UsersTableProps) {
  const { items, total, page, pageSize, totalPages } = result;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-6">
      <PageHeader
        title="User list"
        description="All registered users. Click a row to view full details."
        action={
          <Link
            href="/dashboard/users/invite"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007bff] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0069d9]"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Invite user
          </Link>
        }
      />

      <DashCard>
        <DashTableToolbar>
          <form
            action={applyUsersListFilters}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="sort" value={filters.sort} />
            <input type="hidden" name="order" value={filters.order} />
            <input
              type="hidden"
              name="pageSize"
              value={String(filters.pageSize)}
            />

            <div className="min-w-0 flex-1">
              <label
                htmlFor="users-q"
                className="mb-1 block text-xs font-medium text-gray-600"
              >
                Search
              </label>
              <input
                id="users-q"
                name="q"
                type="search"
                defaultValue={filters.q}
                placeholder="Name, email, or phone…"
                className={fieldClass}
              />
            </div>
            <div className="sm:w-40">
              <label
                htmlFor="users-role"
                className="mb-1 block text-xs font-medium text-gray-600"
              >
                Role
              </label>
              <select
                id="users-role"
                name="role"
                defaultValue={filters.role}
                className={fieldClass}
              >
                <option value="all">All roles</option>
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {USER_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:w-36">
              <label
                htmlFor="users-status"
                className="mb-1 block text-xs font-medium text-gray-600"
              >
                Status
              </label>
              <select
                id="users-status"
                name="status"
                defaultValue={filters.status}
                className={fieldClass}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="all">All</option>
              </select>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#007bff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0069d9]"
              >
                Apply
              </button>
              {hasActiveFilters(filters) ? (
                <Link
                  href={buildUsersHref(filters, {
                    q: "",
                    role: "all",
                    status: "active",
                    page: 1,
                  })}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
        </DashTableToolbar>

        <DashTable>
          <DashTableHead>
            <DashTableHeaderRow>
              <DashTh className="min-w-[200px]">
                <SortHeader label="User" field="fullName" filters={filters} />
              </DashTh>
              <DashTh className="w-36">
                <SortHeader label="Role" field="role" filters={filters} />
              </DashTh>
              <DashTh className="w-28">
                <SortHeader label="Status" field="status" filters={filters} />
              </DashTh>
              <DashTh className="w-32">
                <SortHeader
                  label="Joined"
                  field="createdAt"
                  filters={filters}
                />
              </DashTh>
              <DashTh align="right" className="w-24">
                Action
              </DashTh>
            </DashTableHeaderRow>
          </DashTableHead>
          <DashTbody>
            {items.length === 0 ? (
              <DashTableEmpty colSpan={5}>
                No users match these filters.
              </DashTableEmpty>
            ) : (
              items.map((u) => (
                <DashTr key={u.id}>
                  <DashTd className="text-gray-900">
                    <div className="flex min-w-[200px] items-center gap-3">
                      {u.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.avatarUrl}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full border border-gray-200 object-cover"
                        />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#007bff] text-xs font-semibold text-white">
                          {getInitials(u.fullName, u.email)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {u.fullName || "—"}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </DashTd>
                  <DashTd>
                    <UserRoleSelect
                      userId={u.id}
                      value={u.role}
                      canEdit={canManageRoles}
                    />
                  </DashTd>
                  <DashTd>
                    <StatusPill status={u.status} />
                  </DashTd>
                  <DashTd muted nowrap>
                    {formatDate(u.createdAt)}
                  </DashTd>
                  <DashTd align="right">
                    <DashTableAction href={`/dashboard/users/${u.id}`} />
                  </DashTd>
                </DashTr>
              ))
            )}
          </DashTbody>
        </DashTable>

        <DashTableFooter>
          <p className="text-xs text-gray-500">
            Showing {from}–{to} of {total}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <UsersPageSizeSelect filters={filters} />
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={buildUsersHref(filters, { page: page - 1 })}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Previous
                </Link>
              ) : (
                <span className="rounded-lg border border-gray-100 px-3 py-1.5 text-sm text-gray-300">
                  Previous
                </span>
              )}
              <span className="text-xs text-gray-500">
                Page {page} of {Math.max(totalPages, 1)}
              </span>
              {page < totalPages ? (
                <Link
                  href={buildUsersHref(filters, { page: page + 1 })}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Next
                </Link>
              ) : (
                <span className="rounded-lg border border-gray-100 px-3 py-1.5 text-sm text-gray-300">
                  Next
                </span>
              )}
            </div>
          </div>
        </DashTableFooter>
      </DashCard>
    </div>
  );
}
