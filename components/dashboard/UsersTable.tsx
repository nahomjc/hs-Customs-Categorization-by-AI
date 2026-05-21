import Link from "next/link";
import { DashCard, PageHeader } from "@/components/dashboard/ui";
import type { UserListItem } from "@/lib/dashboard/users";

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
      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${styles}`}
    >
      {status}
    </span>
  );
}

type UsersTableProps = {
  users: UserListItem[];
};

export function UsersTable({ users }: UsersTableProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="User list"
        description="All registered users. Click a row to view full details."
      />

      <DashCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 text-left border-b border-gray-100">
                <th className="px-5 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs">
                  User
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs">
                  Email
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs w-24">
                  Role
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs w-28">
                  Status
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs w-32">
                  Tenant
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs w-32">
                  Joined
                </th>
                <th className="px-5 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs w-24 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-gray-500">
                    No users in the database yet.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3 min-w-[160px]">
                        {u.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.avatarUrl}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0"
                          />
                        ) : (
                          <span className="w-9 h-9 rounded-full bg-[#007bff] text-white flex items-center justify-center text-xs font-semibold shrink-0">
                            {getInitials(u.fullName, u.email)}
                          </span>
                        )}
                        <span className="font-medium text-gray-900 truncate">
                          {u.fullName || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{u.email}</td>
                    <td className="px-5 py-3.5 capitalize text-gray-700">
                      {u.role}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={u.status} />
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs font-mono">
                      {u.tenantId}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/dashboard/users/${u.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium text-[#007bff] bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DashCard>
    </div>
  );
}
