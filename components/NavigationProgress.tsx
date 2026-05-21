"use client";

import NextTopLoader from "nextjs-toploader";

/** Top progress bar for Next.js App Router route changes */
export function NavigationProgress() {
  return (
    <NextTopLoader
      color="#007bff"
      height={3}
      showSpinner={false}
      crawl
      crawlSpeed={180}
      speed={280}
      shadow="0 0 12px rgba(0,123,255,0.45)"
      zIndex={10000}
    />
  );
}
