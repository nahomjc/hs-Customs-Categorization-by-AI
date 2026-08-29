"use client";

import { hsBadgeTone } from "@/lib/documentUiUtils";

export function HsCodeBadge({
  code,
  variant = "classified",
}: {
  code: string;
  variant?: "document" | "classified";
}) {
  const tone = hsBadgeTone(code);
  const docStyle =
    variant === "document"
      ? "bg-sky-50 border-sky-200/80 text-sky-900"
      : `${tone.bg} ${tone.border} ${tone.text}`;

  return (
    <code
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold tracking-tight ${docStyle}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${variant === "document" ? "bg-sky-500" : tone.dot}`}
        aria-hidden
      />
      {code}
    </code>
  );
}
