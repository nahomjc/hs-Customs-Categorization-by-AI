import type { ReactNode } from "react";

/** Centered landing content — max 90rem with comfortable side padding */
export function LandingWrap({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`landing-wrap ${className}`}>{children}</div>;
}
