"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { dashInputClass } from "@/components/dashboard/ui";

export type SupplierOption = {
  id: string;
  name: string;
  countryCode?: string | null;
};

type SupplierSearchSelectProps = {
  value: string;
  selectedLabel?: string | null;
  onChange: (supplierId: string, supplier?: SupplierOption | null) => void;
  placeholder?: string;
  id?: string;
};

export function SupplierSearchSelect({
  value,
  selectedLabel,
  onChange,
  placeholder = "Search or create supplier…",
  id,
}: SupplierSearchSelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState(selectedLabel ?? "");

  useEffect(() => {
    setLabel(selectedLabel ?? "");
  }, [selectedLabel]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/suppliers/search?${params}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { items?: SupplierOption[] };
        if (res.ok) setItems(data.items ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [open, query]);

  function handleSelect(supplier: SupplierOption) {
    onChange(supplier.id, supplier);
    setLabel(supplier.name);
    setQuery("");
    setOpen(false);
  }

  function handleClear() {
    onChange("", null);
    setLabel("");
    setQuery("");
    setOpen(false);
  }

  async function handleCreate() {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as SupplierOption & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not create supplier");
      handleSelect({
        id: data.id,
        name: data.name,
        countryCode: data.countryCode,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create supplier",
      );
    } finally {
      setCreating(false);
    }
  }

  const trimmedQuery = query.trim();
  const exactMatch = items.some(
    (s) => s.name.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const showCreate = trimmedQuery.length > 0 && !exactMatch && !loading;
  const inputValue = open ? query : label;

  return (
    <div ref={rootRef} className="relative">
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        value={inputValue}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className={dashInputClass}
      />
      {value ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-800"
        >
          Clear
        </button>
      ) : null}
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1"
        >
          {loading ? (
            <li className="px-3 py-2 text-sm text-slate-500">Searching…</li>
          ) : null}
          {!loading && items.length === 0 && !showCreate ? (
            <li className="px-3 py-2 text-sm text-slate-500">
              Type a name to search or create.
            </li>
          ) : null}
          {items.map((supplier) => (
            <li key={supplier.id}>
              <button
                type="button"
                role="option"
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => handleSelect(supplier)}
              >
                <span className="font-medium text-slate-900">
                  {supplier.name}
                </span>
                {supplier.countryCode ? (
                  <span className="text-xs text-slate-500">
                    {supplier.countryCode}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
          {showCreate ? (
            <li>
              <button
                type="button"
                role="option"
                disabled={creating}
                className="flex w-full items-center px-3 py-2 text-left text-sm font-semibold text-[#007bff] hover:bg-blue-50 disabled:opacity-60"
                onClick={() => void handleCreate()}
              >
                {creating ? "Creating…" : `Create “${trimmedQuery}”`}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
