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

export const adminNavLink = {
  href: "/dashboard/hs-reference",
  label: "HS reference",
  exact: false,
} as const;

export const settingsLink = {
  href: "/dashboard/settings",
  label: "Settings",
  exact: false,
} as const;

export function getDashboardNavLinks(isAdmin: boolean) {
  return isAdmin ? [...mainNavLinks, adminNavLink] : [...mainNavLinks];
}

export function DashboardSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = getDashboardNavLinks(isAdmin);

  return (
    <aside className="hidden lg:flex w-[17rem] shrink-0 flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] sticky top-[4.5rem] max-h-[calc(100vh-6rem)]">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Workspace
        </p>
        <p className="mt-0.5 text-sm font-semibold text-slate-900">
          HS Classification
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
        <div className="mt-3 border-t border-slate-100 pt-3">
          <SidebarLink
            href={settingsLink.href}
            label={settingsLink.label}
            exact={settingsLink.exact}
            pathname={pathname}
          />
        </div>
      </nav>
    </aside>
  );
}

export function DashboardMobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = getDashboardNavLinks(isAdmin);

  return (
    <nav
      className="lg:hidden -mx-1 flex gap-1 overflow-x-auto pb-1 scrollbar-none"
      aria-label="Dashboard mobile"
    >
      {links.map(({ href, label, exact }) => {
        const isActive = isDashboardNavActive(pathname, href, exact);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
              isActive
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20"
                : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50"
            }`}
          >
            {label}
          </Link>
        );
      })}
      <Link
        href={settingsLink.href}
        aria-current={
          isDashboardNavActive(pathname, settingsLink.href, settingsLink.exact)
            ? "page"
            : undefined
        }
        className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
          isDashboardNavActive(pathname, settingsLink.href, settingsLink.exact)
            ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20"
            : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50"
        }`}
      >
        Settings
      </Link>
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
  const isActive = isDashboardNavActive(pathname, href, exact);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
        isActive
          ? "bg-gradient-to-r from-indigo-600/10 via-violet-600/8 to-indigo-600/10 text-indigo-700 shadow-sm shadow-indigo-500/5"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {isActive && (
        <span
          className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-500 to-violet-600"
          aria-hidden
        />
      )}
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
          isActive
            ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25"
            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-700"
        }`}
      >
        <NavIcon href={href} active={isActive} />
      </span>
      <span className={isActive ? "font-semibold" : ""}>{label}</span>
    </Link>
  );
}

function UsersMenuIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function NavIcon({ href, active }: { href: string; active?: boolean }) {
  const className = `h-4 w-4 shrink-0 ${active ? "" : ""}`;

  if (href === "/dashboard/settings") {
    return <SettingsIcon />;
  }
  if (href === "/dashboard/users") {
    return <UsersMenuIcon />;
  }
  if (href === "/dashboard/hs-reference") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    );
  }
  if (href === "/dashboard/import-cases") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    );
  }
  if (href === "/dashboard") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
        />
      </svg>
    );
  }
  if (href === "/dashboard/analytics") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    );
  }
  if (href === "/dashboard/upload") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
        />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
