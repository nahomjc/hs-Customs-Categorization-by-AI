"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { easeOut } from "./motion";

const STATUS_STEPS = [
  { id: "received", label: "Order received", detail: "Packing list uploaded" },
  { id: "parsing", label: "Parsing document", detail: "Extracting line items" },
  { id: "classifying", label: "AI classifying", detail: "Assigning HS codes" },
  { id: "review", label: "Under review", detail: "Broker verification" },
  { id: "export", label: "Export ready", detail: "Grouped file prepared" },
  { id: "complete", label: "Delivered", detail: "Client notified" },
] as const;

const orders = [
  {
    id: "PL-2024-089",
    client: "Acme Imports",
    items: 412,
    currentStep: 2,
    updatedAgo: "Just now",
  },
  {
    id: "PL-2024-090",
    client: "Global Trade Co",
    items: 238,
    currentStep: 4,
    updatedAgo: "12m ago",
  },
  {
    id: "PL-2024-091",
    client: "Nordic Freight",
    items: 156,
    currentStep: 5,
    updatedAgo: "1h ago",
  },
];

const notifications = [
  { id: "n1", orderId: "PL-2024-089", message: "Moved to AI classifying", step: 2, time: "Just now" },
  { id: "n2", orderId: "PL-2024-090", message: "Export file is ready", step: 4, time: "12m ago" },
  { id: "n3", orderId: "PL-2024-091", message: "Order completed & delivered", step: 5, time: "1h ago" },
];

function statusColor(step: number, current: number) {
  if (step < current) return "bg-emerald-500 border-emerald-500 text-white";
  if (step === current) return "bg-[#007bff] border-[#007bff] text-white shadow-md shadow-blue-500/30";
  return "bg-white/60 border-gray-200 text-gray-400";
}

function StatusTimeline({ activeStep }: { activeStep: number }) {
  const reduced = useReducedMotion();

  return (
    <ol className="relative space-y-0">
      {STATUS_STEPS.map((step, i) => {
        const isDone = i < activeStep;
        const isActive = i === activeStep;
        const isLast = i === STATUS_STEPS.length - 1;

        return (
          <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                className={`absolute left-[11px] top-6 bottom-0 w-px ${
                  isDone ? "bg-emerald-300" : "bg-gray-200"
                }`}
                aria-hidden
              />
            )}
            <motion.span
              className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${statusColor(i, activeStep)}`}
              animate={
                reduced || !isActive
                  ? undefined
                  : { scale: [1, 1.12, 1], boxShadow: ["0 0 0 0 rgba(0,123,255,0.4)", "0 0 0 6px rgba(0,123,255,0)", "0 0 0 0 rgba(0,123,255,0)"] }
              }
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            >
              {isDone ? "✓" : i + 1}
            </motion.span>
            <div className="min-w-0 pt-0.5">
              <p className={`text-xs font-semibold ${isActive ? "text-[#007bff]" : isDone ? "text-gray-800" : "text-gray-400"}`}>
                {step.label}
              </p>
              <p className={`text-[10px] mt-0.5 ${isActive ? "text-gray-600" : "text-gray-400"}`}>
                {step.detail}
              </p>
              {isActive && (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-1 mt-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-[#007bff]"
                >
                  <span className="h-1 w-1 rounded-full bg-[#007bff] animate-pulse" aria-hidden />
                  Current stage
                </motion.span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function NotificationToast({
  message,
  orderId,
  time,
  onDone,
}: {
  message: string;
  orderId: string;
  time: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const id = setTimeout(onDone, 4200);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.95 }}
      transition={{ duration: 0.35, ease: easeOut }}
      className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-white px-3 py-2.5 shadow-lg shadow-blue-500/10"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#007bff]/10 text-[#007bff]">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <title>Notification</title>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-gray-900">{orderId}</p>
        <p className="text-[10px] text-gray-600 mt-0.5">{message}</p>
        <p className="text-[9px] text-gray-400 mt-1">{time}</p>
      </div>
    </motion.div>
  );
}

export function OrderStatusPanel() {
  const reduced = useReducedMotion();
  const [selectedOrder, setSelectedOrder] = useState(0);
  const [liveStep, setLiveStep] = useState(orders[0].currentStep);
  const [toast, setToast] = useState<(typeof notifications)[0] | null>(null);
  const [toastQueue, setToastQueue] = useState(0);

  const activeOrder = orders[selectedOrder];

  useEffect(() => {
    setLiveStep(activeOrder.currentStep);
  }, [activeOrder.currentStep]);

  useEffect(() => {
    if (reduced) return;

    const progressId = setInterval(() => {
      setLiveStep((s) => {
        const next = s >= STATUS_STEPS.length - 1 ? 0 : s + 1;
        const order = orders[selectedOrder];
        const notif = notifications.find((n) => n.step === next && n.orderId === order.id);
        if (notif) setToast(notif);
        return next;
      });
    }, 5000);

    return () => clearInterval(progressId);
  }, [reduced, selectedOrder]);

  useEffect(() => {
    if (reduced) return;
    const cycleId = setInterval(() => {
      setSelectedOrder((i) => (i + 1) % orders.length);
      setToastQueue((q) => q + 1);
    }, 15000);
    return () => clearInterval(cycleId);
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const notif = notifications[toastQueue % notifications.length];
    setToast(notif);
    setLiveStep(notif.step);
    const orderIdx = orders.findIndex((o) => o.id === notif.orderId);
    if (orderIdx >= 0) setSelectedOrder(orderIdx);
  }, [toastQueue, reduced]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-bold text-gray-900">Order tracking</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Clients see exactly where each order is</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
          Live updates
        </span>
      </div>

      {/* Notification stack */}
      <div className="relative min-h-[72px] mb-4">
        <AnimatePresence mode="wait">
          {toast && (
            <NotificationToast
              key={toast.id + toastQueue}
              message={toast.message}
              orderId={toast.orderId}
              time={toast.time}
              onDone={() => setToast(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Order list */}
      <div className="space-y-2 mb-5">
        {orders.map((order, i) => {
          const isSelected = i === selectedOrder;
          const step = isSelected ? liveStep : order.currentStep;
          const statusLabel = STATUS_STEPS[step]?.label ?? "Processing";

          return (
            <button
              key={order.id}
              type="button"
              onClick={() => {
                setSelectedOrder(i);
                setLiveStep(order.currentStep);
              }}
              className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all ${
                isSelected
                  ? "border-[#007bff]/30 bg-blue-50/50 shadow-sm"
                  : "border-gray-100 bg-white/60 hover:border-gray-200 hover:bg-white/80"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900">{order.id}</p>
                  <p className="text-[10px] text-gray-500 truncate">{order.client} · {order.items} items</p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                      step >= STATUS_STEPS.length - 1
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-blue-100 text-[#007bff]"
                    }`}
                  >
                    {statusLabel}
                  </span>
                  <p className="text-[9px] text-gray-400 mt-0.5">{order.updatedAgo}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Timeline for selected order */}
      <div className="landing-glass-panel rounded-xl p-4 flex-1">
        <p className="text-[11px] font-semibold text-gray-700 mb-3">
          {activeOrder.id} — progress
        </p>
        <StatusTimeline activeStep={liveStep} />
      </div>
    </div>
  );
}
