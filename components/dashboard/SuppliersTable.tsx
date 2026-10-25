"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CountrySearchSelect } from "@/components/dashboard/CountrySearchSelect";
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
  dashInputClass,
} from "@/components/dashboard/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  SupplierCountryFilter,
  SupplierListItem,
  SupplierSortDir,
  SupplierSortField,
} from "@/lib/suppliers/queries";

const SORT_PRESETS: Array<{
  value: string;
  sortBy: SupplierSortField;
  sortDir: SupplierSortDir;
  label: string;
}> = [
  { value: "name:asc", sortBy: "name", sortDir: "asc", label: "Name A–Z" },
  { value: "name:desc", sortBy: "name", sortDir: "desc", label: "Name Z–A" },
  {
    value: "countryCode:asc",
    sortBy: "countryCode",
    sortDir: "asc",
    label: "Country A–Z",
  },
  {
    value: "countryCode:desc",
    sortBy: "countryCode",
    sortDir: "desc",
    label: "Country Z–A",
  },
  {
    value: "createdAt:desc",
    sortBy: "createdAt",
    sortDir: "desc",
    label: "Created (newest)",
  },
  {
    value: "createdAt:asc",
    sortBy: "createdAt",
    sortDir: "asc",
    label: "Created (oldest)",
  },
  {
    value: "updatedAt:desc",
    sortBy: "updatedAt",
    sortDir: "desc",
    label: "Updated (newest)",
  },
  {
    value: "updatedAt:asc",
    sortBy: "updatedAt",
    sortDir: "asc",
    label: "Updated (oldest)",
  },
];

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
  const [country, setCountry] = useState<SupplierCountryFilter>("");
  const [sort, setSort] = useState("name:asc");
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const skipNextFetch = useRef(true);

  const applyFilters = useCallback(
    async (
      nextSearch: string,
      nextCountry: SupplierCountryFilter,
      nextSort: string,
    ) => {
      setLoading(true);
      try {
        const preset =
          SORT_PRESETS.find((p) => p.value === nextSort) ?? SORT_PRESETS[0];
        const params = new URLSearchParams();
        if (nextSearch.trim()) params.set("search", nextSearch.trim());
        if (nextCountry) params.set("country", nextCountry);
        params.set("sortBy", preset.sortBy);
        params.set("sortDir", preset.sortDir);
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
    },
    [],
  );

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void applyFilters(search, country, sort);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, country, sort, applyFilters]);

  function closeDrawer(open: boolean) {
    setShowCreate(open);
    if (!open) {
      setName("");
      setCountryCode("");
    }
  }

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
      closeDrawer(false);
      await applyFilters(search, country, sort);
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
          <DashButton type="button" onClick={() => setShowCreate(true)}>
            Add supplier
          </DashButton>
        }
      />

      <Dialog open={showCreate} onOpenChange={closeDrawer}>
        <DialogContent
          showClose
          className="!fixed !inset-y-0 !right-0 !left-auto !top-0 !flex !h-full !max-h-none !w-full !max-w-md !translate-x-0 !translate-y-0 !flex-col !gap-0 !rounded-none !border-y-0 !border-l !border-r-0 !border-slate-200 !bg-white !p-0 !shadow-xl sm:!max-w-md"
        >
          <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left">
            <DialogTitle>Add supplier</DialogTitle>
            <DialogDescription>
              Create a supplier to reuse on import cases.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <div className="space-y-1.5">
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
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
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
            </div>
            <DialogFooter className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:justify-end">
              <DashButton
                type="button"
                variant="secondary"
                onClick={() => closeDrawer(false)}
                disabled={creating}
              >
                Cancel
              </DashButton>
              <DashButton type="submit" disabled={creating}>
                {creating ? "Saving…" : "Save supplier"}
              </DashButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DashCard>
        <DashTableToolbar>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void applyFilters(search, country, sort);
                }
              }}
              placeholder="Search suppliers…"
              className={`${dashInputClass} sm:min-w-0 sm:flex-1 sm:w-auto`}
              aria-label="Search suppliers"
            />
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <DashSelect
                value={country}
                onChange={(v) => setCountry(v as SupplierCountryFilter)}
                aria-label="Filter by country"
                className="w-[12rem]"
                options={[
                  { value: "", label: "All countries" },
                  { value: "with", label: "Has country" },
                  { value: "without", label: "No country" },
                ]}
              />
              <DashSelect
                value={sort}
                onChange={setSort}
                aria-label="Sort suppliers"
                className="w-[13.5rem]"
                options={SORT_PRESETS.map((p) => ({
                  value: p.value,
                  label: p.label,
                }))}
              />
              <DashButton
                onClick={() => void applyFilters(search, country, sort)}
                disabled={loading}
              >
                {loading ? "Loading…" : "Filter"}
              </DashButton>
            </div>
          </div>
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
                No suppliers match. Try clearing filters or add a supplier.
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
