"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ISO_COUNTRIES } from "@/lib/countries";
import { dashInputClass } from "@/components/dashboard/ui";

type CountrySearchSelectProps = {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  id?: string;
};

export function CountrySearchSelect({
  value,
  onChange,
  placeholder = "Search by code or country name…",
  id,
}: CountrySearchSelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = ISO_COUNTRIES.find((c) => c.code === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ISO_COUNTRIES;
    return ISO_COUNTRIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q),
    );
  }, [query]);

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

  function handleSelect(code: string) {
    onChange(code);
    setQuery("");
    setOpen(false);
  }

  function handleClear() {
    onChange("");
    setQuery("");
    setOpen(false);
  }

  const inputValue = open
    ? query
    : selected
      ? `${selected.code} — ${selected.name}`
      : "";

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
          if (!e.target.value.trim()) onChange("");
        }}
        onFocus={() => {
          setOpen(true);
          if (selected && !query) setQuery("");
        }}
        className={`${dashInputClass} pl-3`}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear country"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          ×
        </button>
      ) : null}
      {open ? (
        <div
          id={listId}
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">No countries found</p>
          ) : (
            filtered.map((country) => (
              <button
                key={country.code}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(country.code)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  country.code === value
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-800"
                }`}
              >
                <span className="font-medium">{country.code}</span>
                <span className="text-slate-500"> — {country.name}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
