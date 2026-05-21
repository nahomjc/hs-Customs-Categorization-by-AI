"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const mainNavLinks = [
  { href: "/dashboard", label: "Dashboard", exact: true },
  { href: "/dashboard/upload", label: "Upload", exact: false },
  { href: "/dashboard/history", label: "History", exact: false },
  { href: "/dashboard/users", label: "User list", exact: false },
] as const;

const settingsLink = {
  href: "/dashboard/settings",
  label: "Settings",
  exact: false,
} as const;

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col landing-float-card bg-white rounded-2xl border border-gray-100 overflow-hidden sticky top-20 max-h-[calc(100vh-6rem)]">
      <nav className="p-3 flex flex-col flex-1 min-h-0" aria-label="Dashboard">
        <div className="space-y-1 flex-1">
          {mainNavLinks.map(({ href, label, exact }) => (
            <SidebarLink
              key={href}
              href={href}
              label={label}
              exact={exact}
              pathname={pathname}
            />
          ))}
        </div>
        <div className="pt-3 mt-3 border-t border-gray-100">
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
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        isActive
          ? "bg-[#007bff]/10 text-[#007bff]"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      <NavIcon href={href} />
      {label}
    </Link>
  );
}

function UsersMenuIcon() {
  return (
    <svg
      className="w-4 h-4 shrink-0 opacity-70"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <title>Users</title>
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
    <svg
      className="w-4 h-4 shrink-0 opacity-70"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <title>Settings</title>
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

function NavIcon({ href }: { href: string }) {
  if (href === "/dashboard/settings") {
    return <SettingsIcon />;
  }
  if (href === "/dashboard/users") {
    return <UsersMenuIcon />;
  }
  if (href === "/dashboard") {
    return (
      <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <title>Dashboard</title>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    );
  }
  if (href === "/dashboard/upload") {
    return (
      <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <title>Upload</title>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <title>History</title>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
