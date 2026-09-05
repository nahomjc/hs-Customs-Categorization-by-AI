"use client";

import { useEffect, useId, useRef, useState } from "react";
import { dashInputClass } from "@/components/dashboard/ui";

export type ClientOption = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
};

type ClientSearchSelectProps = {
  value: string;
  selectedLabel?: string | null;
  onChange: (clientId: string, client?: ClientOption | null) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
};

export function ClientSearchSelect({
  value,
  selectedLabel,
  onChange,
  placeholder = "Search client by name, email, or phone…",
  id,
  required,
}: ClientSearchSelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);
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
        const params = new URLSearchParams({ role: "client" });
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/dashboard/users/search?${params}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { items?: ClientOption[] };
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

  function handleSelect(client: ClientOption) {
    onChange(client.id, client);
    setLabel(
      `${client.fullName ?? client.email}${client.phone ? ` · ${client.phone}` : ""}`,
    );
    setQuery("");
    setOpen(false);
  }

  function handleClear() {
    onChange("", null);
    setLabel("");
    setQuery("");
    setOpen(false);
  }

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
        required={required && !value}
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
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {loading ? (
            <li className="px-3 py-2 text-sm text-slate-500">Searching…</li>
          ) : items.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">
              No clients found. Invite a user with role Client first.
            </li>
          ) : (
            items.map((client) => (
              <li key={client.id}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => handleSelect(client)}
                >
                  <span className="font-medium text-slate-900">
                    {client.fullName ?? "Unnamed client"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {client.email}
                    {client.phone ? ` · ${client.phone}` : ""}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
