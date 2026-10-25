"use client";

import { useEffect, useState } from "react";

const BACK_ONLINE_MS = 3500;

export function NetworkStatusBar() {
  const [online, setOnline] = useState(true);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setOnline(navigator.onLine);

    function handleOnline() {
      setOnline(true);
      setShowBackOnline(true);
    }

    function handleOffline() {
      setOnline(false);
      setShowBackOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!showBackOnline) return;
    const timer = window.setTimeout(() => setShowBackOnline(false), BACK_ONLINE_MS);
    return () => window.clearTimeout(timer);
  }, [showBackOnline]);

  if (!hydrated) return null;
  if (online && !showBackOnline) return null;

  const isOffline = !online;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 bottom-0 z-[200] border-t px-4 py-2.5 text-center text-sm font-medium shadow-[0_-4px_24px_rgba(15,23,42,0.12)] transition-colors ${
        isOffline
          ? "border-slate-700/40 bg-slate-900 text-white"
          : "border-emerald-600/30 bg-emerald-700 text-white"
      }`}
      style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {isOffline ? (
          <>
            <OfflineIcon />
            You&apos;re offline. Check your connection.
          </>
        ) : (
          <>
            <OnlineIcon />
            You&apos;re back online
          </>
        )}
      </span>
    </div>
  );
}

function OfflineIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 opacity-90"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 12h.01M15.536 8.464a5 5 0 010 7.072"
      />
    </svg>
  );
}

function OnlineIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 opacity-90"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01M3 12a9 9 0 1118 0"
      />
    </svg>
  );
}
