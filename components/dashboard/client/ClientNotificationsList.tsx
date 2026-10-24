import Link from "next/link";

export type ClientNotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  importCaseId: string | null;
  read?: boolean;
};

function formatWhen(value: Date) {
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type ClientNotificationsListProps = {
  items: ClientNotificationItem[];
  compact?: boolean;
  emptyLabel?: string;
};

export function ClientNotificationsList({
  items,
  compact = false,
  emptyLabel = "No updates yet.",
}: ClientNotificationsListProps) {
  if (items.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-gray-500 sm:px-5">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className={compact ? "divide-y divide-gray-100" : "divide-y divide-gray-50"}>
      {items.map((n) => {
        const content = (
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900">{n.title}</p>
              <time className="shrink-0 text-[11px] text-gray-400">
                {formatWhen(n.createdAt)}
              </time>
            </div>
            <p
              className={`mt-1 text-sm leading-relaxed text-gray-600 ${
                compact ? "line-clamp-4" : ""
              }`}
            >
              {n.body}
            </p>
          </div>
        );

        const rowClass = compact
          ? "flex px-3 py-3 transition-colors hover:bg-gray-50/80"
          : "flex px-4 py-3.5 transition-colors hover:bg-gray-50/80 sm:px-5 sm:py-4";

        return (
          <li key={n.id}>
            {n.importCaseId ? (
              <Link href={`/dashboard/my-shipments/${n.importCaseId}`} className={rowClass}>
                {content}
              </Link>
            ) : (
              <div className={rowClass}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
