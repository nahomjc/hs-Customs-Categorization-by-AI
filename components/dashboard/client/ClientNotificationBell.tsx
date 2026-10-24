"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ClientNotificationsList,
  type ClientNotificationItem,
} from "@/components/dashboard/client/ClientNotificationsList";

type ClientNotificationBellProps = {
  initialItems: ClientNotificationItem[];
};

export function ClientNotificationBell({
  initialItems,
}: ClientNotificationBellProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const unread = initialItems.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unread > 0
            ? `Notifications, ${unread} unread`
            : "Notifications"
        }
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 transition-colors hover:border-[#007bff]/30 hover:bg-blue-50/50 hover:text-[#007bff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007bff]/30"
      >
        <svg
          className="h-5 w-5"
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
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#007bff] px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Shipment notifications"
          className="absolute right-0 z-50 mt-2 w-[min(100vw-1.5rem,22rem)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Updates</p>
            <p className="text-xs text-slate-500">
              Messages from your broker about your shipments
            </p>
          </div>
          <div className="max-h-[min(70vh,24rem)] overflow-y-auto">
            <ClientNotificationsList
              items={initialItems.slice(0, 12)}
              compact
              emptyLabel="No shipment updates yet."
            />
          </div>
          <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-center">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-[#007bff] hover:text-[#0069d9]"
            >
              Open track order
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
