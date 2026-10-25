"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { DashButton } from "@/components/dashboard/ui";

export type InboxItem = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string | Date;
  importCaseId: string | null;
};

type Filter = "all" | "unread";

type NotificationsInboxProps = {
  initialItems: InboxItem[];
  initialSelectedId?: string | null;
};

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function formatListWhen(value: string | Date) {
  const d = toDate(value);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDetailWhen(value: string | Date) {
  return toDate(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NotificationsInbox({
  initialItems,
  initialSelectedId = null,
}: NotificationsInboxProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? initialItems[0]?.id ?? null,
  );
  const [pending, startTransition] = useTransition();
  const autoReadDone = useRef(false);

  const unreadCount = useMemo(
    () => items.filter((n) => !n.read).length,
    [items],
  );

  const visible = useMemo(
    () => (filter === "unread" ? items.filter((n) => !n.read) : items),
    [filter, items],
  );

  const selected = useMemo(
    () => items.find((n) => n.id === selectedId) ?? null,
    [items, selectedId],
  );

  async function markRead(id: string, read: boolean) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read } : n)),
    );
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read }),
      });
      if (!res.ok) throw new Error("Failed");
      startTransition(() => router.refresh());
    } catch {
      toast.error("Could not update notification");
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: !read } : n)),
      );
    }
  }

  useEffect(() => {
    if (autoReadDone.current || !selectedId) return;
    const item = items.find((n) => n.id === selectedId);
    if (!item || item.read) return;
    autoReadDone.current = true;
    void markRead(item.id, true);
    // One-shot when opening a deep link; markRead identity is stable enough here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, items]);

  function selectItem(id: string) {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("id", id);
    window.history.replaceState({}, "", url.pathname + url.search);
    const item = items.find((n) => n.id === id);
    if (item && !item.read) {
      void markRead(id, true);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    const snapshot = items;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("All marked as read");
      startTransition(() => router.refresh());
    } catch {
      setItems(snapshot);
      toast.error("Could not mark all as read");
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 p-1">
          {(
            [
              { id: "all", label: "All" },
              {
                id: "unread",
                label: unreadCount > 0 ? `Unread (${unreadCount})` : "Unread",
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                filter === tab.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <DashButton
          type="button"
          variant="secondary"
          className="!px-3 !py-1.5 text-xs"
          disabled={pending || unreadCount === 0}
          onClick={() => void markAllRead()}
        >
          Mark all as read
        </DashButton>
      </div>

      <div className="grid min-h-[28rem] lg:grid-cols-[minmax(16rem,22rem)_1fr]">
        <div className="border-b border-slate-200/60 lg:border-b-0 lg:border-r lg:border-slate-200/60">
          {visible.length === 0 ? (
            <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#007bff]">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {filter === "unread" ? "No unread messages" : "Inbox zero"}
              </p>
              <p className="text-xs text-slate-500">
                Shipment updates from your broker show up here.
              </p>
            </div>
          ) : (
            <ul className="max-h-[min(70vh,36rem)] divide-y divide-slate-100 overflow-y-auto">
              {visible.map((n) => {
                const active = n.id === selectedId;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => selectItem(n.id)}
                      className={`flex w-full gap-3 px-4 py-3.5 text-left transition-colors ${
                        active
                          ? "bg-blue-50/80"
                          : n.read
                            ? "bg-white hover:bg-slate-50/80"
                            : "bg-slate-50/50 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          n.read ? "bg-transparent" : "bg-[#007bff]"
                        }`}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span
                            className={`truncate text-sm ${
                              n.read
                                ? "font-medium text-slate-700"
                                : "font-bold text-slate-900"
                            }`}
                          >
                            {n.title}
                          </span>
                          <time className="shrink-0 text-[11px] text-slate-400">
                            {formatListWhen(n.createdAt)}
                          </time>
                        </span>
                        <span
                          className={`mt-0.5 line-clamp-2 text-xs leading-relaxed ${
                            n.read
                              ? "text-slate-500"
                              : "font-medium text-slate-600"
                          }`}
                        >
                          {n.body}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex min-h-[16rem] flex-col">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <p className="text-sm font-medium text-slate-500">
                Select a message to read
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900">
                    {selected.title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDetailWhen(selected.createdAt)}
                    {!selected.read ? (
                      <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#007bff]">
                        Unread
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.read ? (
                    <DashButton
                      type="button"
                      variant="secondary"
                      className="!px-3 !py-1.5 text-xs"
                      onClick={() => void markRead(selected.id, false)}
                    >
                      Mark unread
                    </DashButton>
                  ) : (
                    <DashButton
                      type="button"
                      variant="secondary"
                      className="!px-3 !py-1.5 text-xs"
                      onClick={() => void markRead(selected.id, true)}
                    >
                      Mark as read
                    </DashButton>
                  )}
                  {selected.importCaseId ? (
                    <DashButton
                      href={`/dashboard/my-shipments/${selected.importCaseId}`}
                      className="!px-3 !py-1.5 text-xs"
                    >
                      Open shipment
                    </DashButton>
                  ) : null}
                </div>
              </div>
              <div className="flex-1 px-5 py-5">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {selected.body}
                </p>
                {selected.importCaseId ? (
                  <p className="mt-6 text-sm text-slate-500">
                    Related shipment:{" "}
                    <Link
                      href={`/dashboard/my-shipments/${selected.importCaseId}`}
                      className="font-semibold text-[#007bff] hover:text-[#0069d9]"
                    >
                      View tracking
                    </Link>
                  </p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
