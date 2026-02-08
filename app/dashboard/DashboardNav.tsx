"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/upload", label: "Upload" },
  { href: "/dashboard/history", label: "History" },
  { href: "/", label: "Home" },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5">
      {links.map(({ href, label }) => {
        const isActive =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-white/10 text-[var(--dark-foreground)]"
                : "text-[var(--dark-foreground-muted)] hover:text-[var(--dark-foreground)] hover:bg-white/5"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
