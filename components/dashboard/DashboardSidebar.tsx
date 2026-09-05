"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isDashboardNavActive } from "@/lib/dashboardNav";

export const mainNavLinks = [
  { href: "/dashboard", label: "Dashboard", exact: true },
  { href: "/dashboard/import-cases", label: "Import cases", exact: false },
  { href: "/dashboard/analytics", label: "Analytics", exact: false },
  { href: "/dashboard/upload", label: "Upload", exact: false },
  { href: "/dashboard/history", label: "History", exact: false },
  { href: "/dashboard/users", label: "User list", exact: false },
] as const;

export const clientNavLinks = [
  { href: "/dashboard", label: "Dashboard", exact: true },
  { href: "/dashboard/my-shipments", label: "My shipments", exact: false },
] as const;

export const adminNavLink = {
  href: "/dashboard/hs-reference",
  label: "HS reference",
  exact: false,
} as const;

export const channelsNavLink = {
  href: "/dashboard/settings/channels",
  label: "Channels",
  exact: false,
} as const;

export const settingsLink = {
  href: "/dashboard/settings",
  label: "Settings",
  exact: false,
} as const;

export function getDashboardNavLinks(options: {
  isAdmin?: boolean;
  isClient?: boolean;
}) {
  if (options.isClient) {
    return [...clientNavLinks];
  }
  return options.isAdmin
    ? [...mainNavLinks, adminNavLink, channelsNavLink]
    : [...mainNavLinks];
}

export function DashboardSidebar({
  isAdmin = false,
  isClient = false,
}: {
  isAdmin?: boolean;
  isClient?: boolean;
}) {
  const pathname = usePathname();
  const links = getDashboardNavLinks({ isAdmin, isClient });

  return (
    <aside className="hidden lg:flex w-[17rem] shrink-0 flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] sticky top-[4.5rem] max-h-[calc(100vh-6rem)]">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Workspace
        </p>
        <p className="mt-0.5 text-sm font-semibold text-slate-900">
          {isClient ? "Shipment tracking" : "HS Classification"}
        </p>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col p-3" aria-label="Dashboard">
        <div className="flex-1 space-y-1">
          {links.map(({ href, label, exact }) => (
            <SidebarLink
              key={href}
              href={href}
              label={label}
              exact={exact}
              pathname={pathname}
            />
          ))}
        </div>
        {!isClient ? (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <SidebarLink
              href={settingsLink.href}
              label={settingsLink.label}
              exact={settingsLink.exact}
              pathname={pathname}
            />
          </div>
        ) : null}
      </nav>
    </aside>
  );
}

export function DashboardMobileNav({
  isAdmin = false,
  isClient = false,
}: {
  isAdmin?: boolean;
  isClient?: boolean;
}) {
  const pathname = usePathname();
  const links = getDashboardNavLinks({ isAdmin, isClient });

  return (
    <nav
      className="lg:hidden -mx-1 flex gap-1 overflow-x-auto pb-1 scrollbar-none"
      aria-label="Dashboard mobile"
    >
      {links.map(({ href, label, exact }) => (
        <Link
          key={href}
          href={href}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            isDashboardNavActive(pathname, href, exact)
              ? "bg-[#007bff] text-white"
              : "bg-white text-slate-600 border border-slate-200"
          }`}
        >
          {label}
        </Link>
      ))}
      {!isClient ? (
        <Link
          href={settingsLink.href}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            isDashboardNavActive(pathname, settingsLink.href, settingsLink.exact)
              ? "bg-[#007bff] text-white"
              : "bg-white text-slate-600 border border-slate-200"
          }`}
        >
          {settingsLink.label}
        </Link>
      ) : null}
    </nav>
  );
}

function SidebarLink({
  href,
  label,
  exact,
  pathname,
}: {
  href: string;
  label: string;
  exact: boolean;
  pathname: string;
}) {
  const active = isDashboardNavActive(pathname, href, exact);
  return (
    <Link
      href={href}
      className={`flex items-center rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-[#007bff] text-white shadow-sm shadow-blue-500/20"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {label}
    </Link>
  );
}
