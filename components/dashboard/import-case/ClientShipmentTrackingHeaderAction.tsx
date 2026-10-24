"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DashButton,
  dashInputClass,
  dashSelectClass,
} from "@/components/dashboard/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TrackingNotificationDelivery } from "@/lib/notifications/notify-tracking";
import {
  TRACKING_STATUSES,
  TRACKING_STATUS_DEFAULT_NOTES,
  TRACKING_STATUS_LABELS,
  type TrackingStatus,
} from "@/lib/tracking/constants";

const ALL_DEFAULT_NOTES = new Set(
  Object.values(TRACKING_STATUS_DEFAULT_NOTES),
);

function toastForTrackingDelivery(
  notifications: TrackingNotificationDelivery | null | undefined,
) {
  if (!notifications) {
    toast.success("Tracking updated.");
    return;
  }
  if (notifications.sms === "sent") {
    toast.success("Tracking updated — client notified by SMS.");
    return;
  }
  if (notifications.sms === "failed") {
    const detail = notifications.messages.find((m) =>
      m.toLowerCase().startsWith("sms:"),
    );
    toast.error(
      detail ?? "Tracking saved, but the SMS could not be delivered.",
    );
    return;
  }
  const smsHint =
    notifications.messages.find((m) =>
      /sms|phone|channels/i.test(m),
    ) ?? "SMS was not sent.";
  toast.warning(`Tracking saved. ${smsHint}`);
}

type ClientShipmentTrackingHeaderActionProps = {
  caseId: string;
  trackingStatus: string | null;
  trackingNote: string | null;
  clientLabel?: string | null;
};

function TruckIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9m9 9v.75m-9-.75H4.125A1.125 1.125 0 013 14.25v2.25m16.875-11.25v7.5"
      />
    </svg>
  );
}

export function ClientShipmentTrackingHeaderAction({
  caseId,
  trackingStatus: trackingStatusProp,
  trackingNote: trackingNoteProp,
  clientLabel,
}: ClientShipmentTrackingHeaderActionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>(
    (trackingStatusProp as TrackingStatus) || "received",
  );
  const [trackingNote, setTrackingNote] = useState(trackingNoteProp ?? "");

  useEffect(() => {
    setTrackingStatus((trackingStatusProp as TrackingStatus) || "received");
    setTrackingNote(trackingNoteProp ?? "");
  }, [trackingStatusProp, trackingNoteProp]);

  useEffect(() => {
    if (!open) return;
    setTrackingNote((note) => {
      const trimmed = note.trim();
      if (!trimmed || ALL_DEFAULT_NOTES.has(trimmed)) {
        return TRACKING_STATUS_DEFAULT_NOTES[trackingStatus];
      }
      return note;
    });
  }, [open, trackingStatus]);

  const statusLabel =
    TRACKING_STATUS_LABELS[
      (trackingStatusProp as TrackingStatus) || "received"
    ];

  function selectTrackingStatus(next: TrackingStatus) {
    setTrackingStatus(next);
    const trimmed = trackingNote.trim();
    if (!trimmed || ALL_DEFAULT_NOTES.has(trimmed)) {
      setTrackingNote(TRACKING_STATUS_DEFAULT_NOTES[next]);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch(`/api/import-cases/${caseId}/tracking`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingStatus,
          trackingNote: trackingNote.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        notifications?: TrackingNotificationDelivery | null;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to update tracking");
      toastForTrackingDelivery(data.notifications);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update tracking",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-w-0 max-w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-left transition-colors hover:border-[#007bff]/35 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007bff]/30"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#007bff]/10 text-[#007bff]">
          <TruckIcon />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900">
            Client shipment tracking
          </span>
          <span className="block truncate text-xs text-slate-500">
            {statusLabel}
            {clientLabel ? ` · ${clientLabel}` : ""}
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-slate-200/35 px-6 py-5 text-left">
            <DialogTitle>Update client shipment tracking</DialogTitle>
            <DialogDescription>
              Status and notes appear on the client dashboard. Telegram and SMS
              alerts are sent when channels are configured.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            {clientLabel ? (
              <p className="rounded-xl border border-slate-200/50 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
                <span className="font-medium text-slate-900">Client: </span>
                {clientLabel}
              </p>
            ) : (
              <p className="rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
                No client linked on this case yet. Link a client under Case
                details to enable dashboard tracking.
              </p>
            )}

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Tracking status
              </span>
              <select
                value={trackingStatus}
                onChange={(e) =>
                  selectTrackingStatus(e.target.value as TrackingStatus)
                }
                className={`w-full ${dashSelectClass}`}
              >
                {TRACKING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TRACKING_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Note for client
              </span>
              <textarea
                value={trackingNote}
                onChange={(e) => setTrackingNote(e.target.value)}
                rows={3}
                placeholder={TRACKING_STATUS_DEFAULT_NOTES[trackingStatus]}
                className={`w-full resize-y ${dashInputClass}`}
              />
              <p className="mt-1 text-xs text-slate-500">
                Prefilled when you change status; edit before notifying the
                client.
              </p>
            </label>
          </div>

          <DialogFooter className="border-t border-slate-200/35 bg-slate-50/50 px-6 py-4">
            <DashButton
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </DashButton>
            <DashButton
              type="button"
              disabled={loading}
              onClick={() => void handleSubmit()}
            >
              {loading ? "Updating…" : "Update & notify client"}
            </DashButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
