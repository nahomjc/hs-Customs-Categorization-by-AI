"use client";

import { getCountryFlagUrl } from "@/lib/countries";

type CountryFlagProps = {
  code: string | null | undefined;
  className?: string;
  title?: string;
  /** Pixel width of the CDN asset (display size controlled by className). */
  size?: 20 | 40 | 80;
};

/**
 * Renders a country flag as an image (flagcdn).
 * Prefer this over emoji flags — Windows often shows ISO letters instead of flags.
 */
export function CountryFlag({
  code,
  className = "h-3.5 w-5 object-cover rounded-[2px] shadow-sm",
  title,
  size = 20,
}: CountryFlagProps) {
  const url = getCountryFlagUrl(code, size);
  if (!url || !code) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- small CDN asset; avoid next/image remote config
    <img
      src={url}
      alt=""
      title={title ?? code.toUpperCase()}
      width={size}
      height={Math.round(size * 0.75)}
      loading="lazy"
      decoding="async"
      className={className}
      aria-hidden
    />
  );
}
