"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CountrySearchSelect } from "@/components/dashboard/CountrySearchSelect";
import {
  DashButton,
  DashCard,
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
  dashInputClass,
} from "@/components/dashboard/ui";
import type { SupplierListItem } from "@/lib/suppliers/queries";

type SuppliersTableProps = {
  initialItems: SupplierListItem[];
  initialTotal: number;
};

export function SuppliersTable({
  initialItems,
  initialTotal,
}: SuppliersTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const skipNextFetch = useRef(true);

  const load = useCallback(async (nextSearch: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      const res = await fetch(`/api/suppliers?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as {
        items: SupplierListItem[];
        total: number;
      };
      setItems(data.items);
      setTotal(data.total);
    } catch {
      toast.error("Could not load suppliers");
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
      void load(search);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Supplier name is required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          countryCode: countryCode || null,
        }),
      });
      const data = (await res.json()) as SupplierListItem & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      toast.success(`Saved ${data.name}`);
      setName("");
      setCountryCode("");
      setShowCreate(false);
      await load(search);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Suppliers"
        description="Tenant supplier master list. Create once, reuse on import cases."
        action={
          <DashButton
            type="button"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "Cancel" : "Add supplier"}
          </DashButton>
        }
      />

      {showCreate ? (
        <DashCard>
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3 sm:items-end"
          >
            <div className="space-y-1.5 sm:col-span-1">
              <label
                htmlFor="supplier-name"
                className="block text-sm font-medium text-slate-700"
              >
                Name *
              </label>
              <input
                id="supplier-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={dashInputClass}
                required
                maxLength={255}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <label
                htmlFor="supplier-country"
                className="block text-sm font-medium text-slate-700"
              >
                Country (optional)
              </label>
              <CountrySearchSelect
                id="supplier-country"
                value={countryCode}
                onChange={setCountryCode}
              />
            </div>
            <DashButton type="submit" disabled={creating}>
              {creating ? "Saving…" : "Save supplier"}
            </DashButton>
          </form>
        </DashCard>
      ) : null}

      <DashCard>
        <DashTableToolbar>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className={`${dashInputClass} max-w-sm`}
            aria-label="Search suppliers"
          />
          <p className="text-xs text-slate-500">
            {loading ? "Loading…" : `${total} supplier${total === 1 ? "" : "s"}`}
          </p>
        </DashTableToolbar>
        <DashTable>
          <DashTableHead>
            <DashTableHeaderRow>
              <DashTh>Name</DashTh>
              <DashTh>Country</DashTh>
              <DashTh>Created</DashTh>
            </DashTableHeaderRow>
          </DashTableHead>
          <DashTbody>
            {items.length === 0 ? (
              <DashTableEmpty colSpan={3}>
                No suppliers yet. Add one here or create from a new import case.
              </DashTableEmpty>
            ) : (
              items.map((row) => (
                <DashTr key={row.id}>
                  <DashTd className="font-medium text-slate-900">
                    {row.name}
                  </DashTd>
                  <DashTd className="text-slate-600">
                    {row.countryCode ?? "—"}
                  </DashTd>
                  <DashTd className="text-slate-500">
                    {new Date(row.createdAt).toLocaleDateString()}
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
