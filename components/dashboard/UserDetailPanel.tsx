import Link from "next/link";
import { DashCard, DashCardHeader, DashLink, StatusBadge } from "@/components/dashboard/ui";
import type { getDashboardUserDetail } from "@/lib/dashboard/users";

type UserDetail = NonNullable<Awaited<ReturnType<typeof getDashboardUserDetail>>>;

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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

const STATUS_LABELS: Record<string, string> = {
  uploaded: "Uploaded",
  parsed: "Parsed",
  ai_processed: "AI processing",
  completed: "Completed",
  failed: "Failed",
};

type UserDetailPanelProps = {
  user: UserDetail;
  /** When viewing your own profile from My account */
  variant?: "self" | "admin";
};

export function UserDetailPanel({ user, variant = "admin" }: UserDetailPanelProps) {
  const meta =
    user.meta && typeof user.meta === "object" && Object.keys(user.meta).length > 0
      ? user.meta
      : null;

  return (
    <div className="space-y-6">
      <div className="landing-float-card bg-white rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="w-20 h-20 rounded-2xl object-cover border border-gray-200"
            />
          ) : (
            <span className="w-20 h-20 rounded-2xl bg-[#007bff] text-white flex items-center justify-center text-2xl font-bold">
              {getInitials(user.fullName, user.email)}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {variant === "self"
                ? user.fullName || "My account"
                : user.fullName || "Unnamed user"}
            </h1>
            <p className="text-gray-500 mt-1">{user.email}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-[#007bff] capitalize">
                {user.role}
              </span>
              <span
                className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                  user.status === "active"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {user.status}
              </span>
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                {user.tenantId}
              </span>
            </div>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <dt className="text-gray-500 text-xs font-medium uppercase tracking-wider">
              User ID
            </dt>
            <dd className="mt-1 font-mono text-xs text-gray-800 break-all">
              {user.id}
            </dd>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <dt className="text-gray-500 text-xs font-medium uppercase tracking-wider">
              Documents
            </dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 tabular-nums">
              {user.documentCount}
            </dd>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <dt className="text-gray-500 text-xs font-medium uppercase tracking-wider">
              Joined
            </dt>
            <dd className="mt-1 text-gray-900">{formatDate(user.createdAt)}</dd>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <dt className="text-gray-500 text-xs font-medium uppercase tracking-wider">
              Last updated
            </dt>
            <dd className="mt-1 text-gray-900">{formatDate(user.updatedAt)}</dd>
          </div>
        </dl>

        {meta ? (
          <div className="mt-6">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Meta
            </h3>
            <pre className="text-xs bg-gray-900 text-gray-100 rounded-xl p-4 overflow-x-auto">
              {JSON.stringify(meta, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>

      <DashCard>
        <DashCardHeader
          title="Recent documents"
          action={
            user.recentDocuments.length > 0 ? (
              <DashLink href="/dashboard/history">All documents →</DashLink>
            ) : undefined
          }
        />
        {user.recentDocuments.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 text-center">
            {variant === "self"
              ? "You have not uploaded any documents yet."
              : "No documents uploaded by this user yet."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {user.recentDocuments.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-gray-50/50"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {doc.originalFileName ?? "Untitled"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(doc.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge
                    status={doc.status}
                    label={STATUS_LABELS[doc.status ?? "uploaded"] ?? doc.status ?? "—"}
                  />
                  <Link
                    href={`/dashboard/documents/${doc.id}`}
                    className="text-sm font-medium text-[#007bff] hover:underline"
                  >
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DashCard>
    </div>
  );
}
