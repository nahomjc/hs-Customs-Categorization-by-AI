import { memo } from "react";
import { hasFlag } from "@/lib/shipments/flag-codes";

/**
 * Country flag from the bundled SVG set in /public/flags (works on Windows,
 * where flag emoji do not render). The image is decorative: always put the
 * country name in text next to it. Without a known country it shows a neutral
 * dashed placeholder instead of guessing.
 */
export const CountryFlag = memo(function CountryFlag({
  iso2,
  className = "h-4 w-6",
}: {
  iso2: string | null | undefined;
  className?: string;
}) {
  if (!hasFlag(iso2)) {
    return (
      <span
        aria-hidden="true"
        className={`inline-block shrink-0 rounded-[3px] border border-dashed border-slate-300 bg-slate-100 ${className}`}
      />
    );
  }
  return (
    // Static same-origin SVG; next/image adds nothing for a 1-2 KB vector.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/flags/${iso2}.svg`}
      alt=""
      aria-hidden="true"
      width={24}
      height={16}
      loading="lazy"
      decoding="async"
      className={`inline-block shrink-0 rounded-[3px] border border-slate-200 object-cover ${className}`}
    />
  );
});