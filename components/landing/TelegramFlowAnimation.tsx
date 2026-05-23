"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { easeOut } from "./motion";

const TELEGRAM_BLUE = "#2AABEE";
const LOOP_MS = 14000;

type AlertTone = "info" | "progress" | "success" | "warning";

type Alert = {
  id: string;
  time: string;
  title: string;
  body: string;
  meta?: string;
  tone: AlertTone;
  dynamicBody?: (ctx: { classified: number; total: number; pct: number }) => string;
};

const TOTAL_ITEMS = 126;
const HS_GROUPS = 28;

const alerts: Alert[] = [
  {
    id: "upload",
    time: "09:14",
    title: "Upload received",
    body: `Packing_List_March.pdf · ${TOTAL_ITEMS} line items queued for classification.`,
    tone: "info",
  },
  {
    id: "progress",
    time: "09:16",
    title: "HS classification in progress",
    body: "",
    dynamicBody: ({ classified, total, pct }) =>
      `Packing_List_March.pdf — ${classified}/${total} items · ${pct}% complete`,
    meta: "ETA ~4 min",
    tone: "progress",
  },
  {
    id: "complete",
    time: "09:21",
    title: "Classification complete",
    body: `${TOTAL_ITEMS} items grouped into ${HS_GROUPS} HS codes. Top: 9405, 9401, 4814, 8414.`,
    meta: "View in dashboard →",
    tone: "success",
  },
  {
    id: "export",
    time: "09:22",
    title: "Export ready",
    body: "Grouped Excel generated for Packing_List_March.pdf — ready for declaration.",
    tone: "success",
  },
];

const toneStyles: Record<AlertTone, { border: string; dot: string; badge: string }> = {
  info: {
    border: "border-sky-200/80",
    dot: "bg-sky-400",
    badge: "bg-sky-50 text-sky-700",
  },
  progress: {
    border: "border-[#007bff]/25",
    dot: "bg-[#007bff]",
    badge: "bg-blue-50 text-[#007bff]",
  },
  success: {
    border: "border-emerald-200/80",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700",
  },
  warning: {
    border: "border-amber-200/80",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-800",
  },
};

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <title>Telegram</title>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  );
}

function AlertBubble({
  alert,
  classified,
  pct,
}: {
  alert: Alert;
  classified: number;
  pct: number;
}) {
  const style = toneStyles[alert.tone];
  const body =
    alert.dynamicBody?.({ classified, total: TOTAL_ITEMS, pct }) ?? alert.body;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, ease: easeOut }}
      className="flex gap-2"
    >
      <div
        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
        style={{ backgroundColor: TELEGRAM_BLUE }}
        aria-hidden
      >
        IL
      </div>
      <div
        className={`flex-1 min-w-0 rounded-2xl rounded-tl-sm bg-white border px-3 py-2.5 shadow-sm ${style.border}`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[11px] font-semibold text-gray-900">{alert.title}</span>
          <span className="text-[10px] text-gray-400 shrink-0">{alert.time}</span>
        </div>
        <p className="text-[11px] text-gray-600 leading-relaxed">{body}</p>
        {alert.tone === "progress" && (
          <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-[#007bff]"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        )}
        {alert.meta && (
          <p className="mt-1.5 text-[10px] font-medium text-[#007bff]">{alert.meta}</p>
        )}
        <div className="mt-2 flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} aria-hidden />
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${style.badge}`}>
            {alert.tone === "progress"
              ? "In progress"
              : alert.tone === "success"
                ? "Completed"
                : alert.tone === "warning"
                  ? "Action needed"
                  : "Event"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function TelegramFlowAnimation() {
  const reduced = useReducedMotion();
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [classified, setClassified] = useState(0);
  const [pct, setPct] = useState(0);
  const [loopKey, setLoopKey] = useState(0);

  useEffect(() => {
    if (reduced) {
      setVisibleIds(alerts.map((a) => a.id));
      setClassified(TOTAL_ITEMS);
      setPct(100);
      return;
    }

    setVisibleIds([]);
    setClassified(0);
    setPct(0);

    const show = (id: string, delay: number) =>
      setTimeout(() => {
        setVisibleIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      }, delay);

    const timers = [
      show("upload", 400),
      show("progress", 1600),
      show("complete", 6200),
      show("export", 7800),
      setTimeout(() => setLoopKey((k) => k + 1), LOOP_MS),
    ];

    return () => timers.forEach((t) => clearTimeout(t));
  }, [reduced, loopKey]);

  const progressVisible = visibleIds.includes("progress");

  useEffect(() => {
    if (reduced || !progressVisible) return;

    setClassified(0);
    setPct(0);
    const steps = 24;
    const stepMs = 3800 / steps;
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 1; i <= steps; i++) {
      timers.push(
        setTimeout(() => {
          const p = Math.round((i / steps) * 100);
          setPct(p);
          setClassified(
            Math.min(TOTAL_ITEMS, Math.round((p / 100) * TOTAL_ITEMS))
          );
        }, stepMs * i)
      );
    }

    return () => timers.forEach(clearTimeout);
  }, [reduced, progressVisible, loopKey]);

  const visibleAlerts = alerts.filter((a) => visibleIds.includes(a.id));

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.65, ease: easeOut }}
      className="landing-float-card rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-xl"
      aria-live="polite"
      aria-label="Telegram classification alerts preview"
    >
      <div
        className="flex items-center gap-3 px-4 py-3 text-white"
        style={{
          background: `linear-gradient(135deg, ${TELEGRAM_BLUE} 0%, #229ED9 100%)`,
        }}
      >
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <TelegramIcon className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">Impact Logistics — HS Ops</p>
          <p className="text-[11px] text-white/85">12 members · bot active</p>
        </div>
        <motion.span
          className="text-[10px] font-medium bg-white/20 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1"
          animate={{ opacity: [1, 0.6, 1] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" aria-hidden />
          Live
        </motion.span>
      </div>

      <div
        className="p-4 min-h-[380px] sm:min-h-[400px] flex flex-col"
        style={{
          background:
            "linear-gradient(180deg, #e8f4fc 0%, #dbeafe 40%, #f0f9ff 100%)",
        }}
      >
        <p className="text-center text-[10px] text-gray-500 font-medium py-1 shrink-0">
          Today
        </p>
        <div className="flex-1 space-y-3 overflow-hidden">
          <AnimatePresence mode="popLayout">
            {visibleAlerts.map((alert) => (
              <AlertBubble
                key={`${loopKey}-${alert.id}`}
                alert={alert}
                classified={classified}
                pct={pct}
              />
            ))}
          </AnimatePresence>
          {visibleIds.length === 0 && !reduced && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-[11px] text-gray-400 py-8"
            >
              Waiting for classification events…
            </motion.p>
          )}
        </div>
      </div>

      <div className="px-3 py-2.5 bg-white border-t border-gray-100 flex items-center gap-2">
        <div className="flex-1 h-9 rounded-full bg-gray-100 px-3 flex items-center">
          <span className="text-[11px] text-gray-400">Alerts delivered automatically</span>
        </div>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: TELEGRAM_BLUE }}
          aria-hidden
        >
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <title>Send</title>
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}
