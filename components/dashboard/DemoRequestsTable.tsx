"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DashButton,
  DashCard,
  DashSelect,
  DashTable,
  DashTableEmpty,
  DashTableHead,
  DashTableHeaderRow,
  DashTableToolbar,
  DashTbody,
  DashTd,
  DashTh,
  DashTr,
  PageHeader,
  StatusBadge,
  TruncatedText,
  dashInputClass,
} from "@/components/dashboard/ui";
import {
  DEMO_REQUEST_STATUSES,
  DEMO_REQUEST_STATUS_LABELS,
  type DemoRequestStatus,
} from "@/lib/demo-requests/constants";
import type { DemoRequestListItem } from "@/lib/demo-requests/queries";

const VOLUME_LABELS: Record<string, string> = {
  under_50: "Under 50 / mo",
  "50_200": "50–200 / mo",
  "200_plus": "200+ / mo",
};

type DemoRequestsTableProps = {
  initialItems: DemoRequestListItem[];
  initialTotal: number;
  initialNewCount: number;
};

export function DemoRequestsTable({
  initialItems,
  initialTotal,
  initialNewCount,
}: DemoRequestsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DemoRequestStatus | "">("");
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [newCount, setNewCount] = useState(initialNewCount);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const skipNextFetch = useRef(true);

  const load = useCallback(async (nextSearch: string, nextStatus: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      if (nextStatus) params.set("status", nextStatus);
      const res = await fetch(`/api/demo-requests?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as {
        items: DemoRequestListItem[];
        total: number;
      };
      setItems(data.items);
      setTotal(data.total);
    } catch {
      toast.error("Could not load demo requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void load(search, status);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, status, load]);

  async function updateStatus(id: string, next: DemoRequestStatus) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/demo-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json()) as {
        error?: string;
        item?: DemoRequestListItem;
      };
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      const updated = data.item;
      if (updated) {
        setItems((prev) =>
          prev.map((row) => (row.id === id ? { ...row, ...updated } : row)),
        );
        setNewCount((c) => {
          const wasNew = items.find((i) => i.id === id)?.status === "new";
          if (wasNew && next !== "new") return Math.max(0, c - 1);
          if (!wasNew && next === "new") return c + 1;
          return c;
        });
      }
      toast.success(`Marked as ${DEMO_REQUEST_STATUS_LABELS[next]}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Demo requests"
        description="Leads from the public demo form. Contact them and update status as you go."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200/70 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Total
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{total}</p>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            New
          </p>
          <p className="mt-1 text-2xl font-semibold text-[#007bff]">{newCount}</p>
        </div>
      </div>

      <DashCard>
        <DashTableToolbar>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="search"
              placeholder="Search name, email, company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${dashInputClass} sm:min-w-0 sm:flex-1 sm:w-auto`}
              aria-label="Search demo requests"
            />
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <DashSelect
                value={status}
                onChange={(v) => setStatus(v as DemoRequestStatus | "")}
                aria-label="Filter by status"
                className="w-[11.5rem]"
                options={[
                  { value: "", label: "All statuses" },
                  ...DEMO_REQUEST_STATUSES.map((s) => ({
                    value: s,
                    label: DEMO_REQUEST_STATUS_LABELS[s],
                  })),
                ]}
              />
              <DashButton
                onClick={() => void load(search, status)}
                disabled={loading}
              >
                {loading ? "Loading…" : "Filter"}
              </DashButton>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {loading ? "Searching…" : `${total} request(s)`}
          </p>
        </DashTableToolbar>

        <DashTable>
          <DashTableHead>
            <DashTableHeaderRow>
              <DashTh>Contact</DashTh>
              <DashTh>Company</DashTh>
              <DashTh>Volume</DashTh>
              <DashTh>Message</DashTh>
              <DashTh>Source</DashTh>
              <DashTh>Submitted</DashTh>
              <DashTh>Status</DashTh>
            </DashTableHeaderRow>
          </DashTableHead>
          <DashTbody>
            {items.length === 0 ? (
              <DashTableEmpty colSpan={7}>
                No demo requests yet. When someone submits{" "}
                <span className="font-medium">/demo</span>, they show up here.
              </DashTableEmpty>
            ) : (
              items.map((item) => (
                <DashTr key={item.id}>
                  <DashTd className="text-gray-900">
                    <p className="font-semibold">{item.fullName}</p>
                    <a
                      href={`mailto:${item.email}`}
                      className="text-xs text-[#007bff] hover:underline"
                    >
                      {item.email}
                    </a>
                    {item.phone ? (
                      <p className="text-xs text-slate-500">{item.phone}</p>
                    ) : null}
                    {item.jobTitle ? (
                      <p className="text-xs text-slate-400">{item.jobTitle}</p>
                    ) : null}
                  </DashTd>
                  <DashTd>{item.company}</DashTd>
                  <DashTd muted>
                    {item.monthlyVolume
                      ? (VOLUME_LABELS[item.monthlyVolume] ?? item.monthlyVolume)
                      : "—"}
                  </DashTd>
                  <DashTd className="max-w-[14rem]">
                    <TruncatedText text={item.message ?? "—"} />
                  </DashTd>
                  <DashTd muted className="text-xs">
                    {item.source}
                  </DashTd>
                  <DashTd muted className="text-xs whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleString()}
                  </DashTd>
                  <DashTd>
                    <div className="flex flex-col gap-1.5">
                      <StatusBadge
                        label={
                          DEMO_REQUEST_STATUS_LABELS[
                            item.status as DemoRequestStatus
                          ] ?? item.status
                        }
                        status={item.status}
                      />
                      <DashSelect
                        value={item.status}
                        disabled={updatingId === item.id}
                        aria-label={`Status for ${item.fullName}`}
                        onChange={(v) => {
                          if (isDemoStatus(v) && v !== item.status) {
                            void updateStatus(item.id, v);
                          }
                        }}
                        options={DEMO_REQUEST_STATUSES.map((s) => ({
                          value: s,
                          label: DEMO_REQUEST_STATUS_LABELS[s],
                        }))}
                      />
                    </div>
                  </DashTd>
                </DashTr>
              ))
            )}
          </DashTbody>
        </DashTable>
      </DashCard>
    </div>
  );
}

function isDemoStatus(value: string): value is DemoRequestStatus {
  return (DEMO_REQUEST_STATUSES as readonly string[]).includes(value);
}
