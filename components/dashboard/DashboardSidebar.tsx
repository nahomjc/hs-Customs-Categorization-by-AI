"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isDashboardNavActive } from "@/lib/dashboardNav";

type NavLink = {
  href: string;
  label: string;
  exact: boolean;
  icon: ReactNode;
};

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const icons = {
  dashboard: (
    <NavIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"
      />
    </NavIcon>
  ),
  importCases: (
    <NavIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M12 12v4M10 14h4"
      />
    </NavIcon>
  ),
  analytics: (
    <NavIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 19V9M10 19V5M16 19v-7M22 19H2"
      />
    </NavIcon>
  ),
  upload: (
    <NavIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
      />
    </NavIcon>
  ),
  history: (
    <NavIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 2m6-2a9 9 0 1 1-2.64-6.36L21 6v4h-4"
      />
    </NavIcon>
  ),
  users: (
    <NavIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
      />
    </NavIcon>
  ),
  shipments: (
    <NavIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7h13l5 5v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 7v5h5M7.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
      />
    </NavIcon>
  ),
  hsReference: (
    <NavIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z"
      />
    </NavIcon>
  ),
  hsSearch: (
    <NavIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-4.35-4.35M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"
      />
    </NavIcon>
  ),
  channels: (
    <NavIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 8h10M7 12h6M5 4h14a1 1 0 0 1 1 1v14l-4-3H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
      />
    </NavIcon>
  ),
  vdd: (
    <NavIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"
      />
    </NavIcon>
  ),
  settings: (
    <NavIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </NavIcon>
  ),
};

export const mainNavLinks: NavLink[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    exact: true,
    icon: icons.dashboard,
  },
  {
    href: "/dashboard/import-cases",
    label: "Import cases",
    exact: false,
    icon: icons.importCases,
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    exact: false,
    icon: icons.analytics,
  },
  {
    href: "/dashboard/upload",
    label: "Upload",
    exact: false,
    icon: icons.upload,
  },
  {
    href: "/dashboard/history",
    label: "History",
    exact: false,
    icon: icons.history,
  },
  {
    href: "/dashboard/users",
    label: "User list",
    exact: false,
    icon: icons.users,
  },
];

export const clientNavLinks: NavLink[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    exact: true,
    icon: icons.dashboard,
  },
  {
    href: "/dashboard/my-shipments",
    label: "My shipments",
    exact: false,
    icon: icons.shipments,
  },
];

export const adminNavLink: NavLink = {
  href: "/dashboard/hs-reference",
  label: "HS reference",
  exact: false,
  icon: icons.hsReference,
};

export const hsCodeSearchNavLink: NavLink = {
  href: "/dashboard/tools/hs-code-search",
  label: "HS code search",
  exact: false,
  icon: icons.hsSearch,
};

export const channelsNavLink: NavLink = {
  href: "/dashboard/settings/channels",
  label: "Channels",
  exact: false,
  icon: icons.channels,
};

export const vddNavLink: NavLink = {
  href: "/dashboard/settings/vdd",
  label: "VDD import",
  exact: false,
  icon: icons.vdd,
};

export const settingsLink: NavLink = {
  href: "/dashboard/settings",
  label: "Settings",
  exact: true,
  icon: icons.settings,
};

export function getDashboardNavLinks(options: {
  isAdmin?: boolean;
  isAssessor?: boolean;
  isClient?: boolean;
}) {
  if (options.isClient) {
    return [...clientNavLinks];
  }
  const links = [...mainNavLinks];
  if (options.isAdmin || options.isAssessor) {
    links.push(hsCodeSearchNavLink);
  }
  if (options.isAdmin) {
    links.push(adminNavLink, channelsNavLink, vddNavLink);
  }
  return links;
}

export function DashboardSidebar({
  isAdmin = false,
  isAssessor = false,
  isClient = false,
}: {
  isAdmin?: boolean;
  isAssessor?: boolean;
  isClient?: boolean;
}) {
  const pathname = usePathname();
  const links = getDashboardNavLinks({ isAdmin, isAssessor, isClient });

  return (
    <aside className="hidden lg:flex w-[17rem] shrink-0 flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] sticky top-[4.5rem] max-h-[calc(100vh-6rem)] lg:ml-3">
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
          {links.map(({ href, label, exact, icon }) => (
            <SidebarLink
              key={href}
              href={href}
              label={label}
              exact={exact}
              icon={icon}
              pathname={pathname}
            />
          ))}
        </div>
        <div className="mt-3 border-t border-slate-100 pt-3">
          <SidebarLink
            href={settingsLink.href}
            label={settingsLink.label}
            exact={settingsLink.exact}
            icon={settingsLink.icon}
            pathname={pathname}
          />
        </div>
      </nav>
    </aside>
  );
}

export function DashboardMobileNav({
  isAdmin = false,
  isAssessor = false,
  isClient = false,
}: {
  isAdmin?: boolean;
  isAssessor?: boolean;
  isClient?: boolean;
}) {
  const pathname = usePathname();
  const links = getDashboardNavLinks({ isAdmin, isAssessor, isClient });

  return (
    <nav
      className="lg:hidden -mx-1 flex gap-1 overflow-x-auto pb-1 scrollbar-none"
      aria-label="Dashboard mobile"
    >
      {links.map(({ href, label, exact, icon }) => (
        <Link
          key={href}
          href={href}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            isDashboardNavActive(pathname, href, exact)
              ? "bg-[#007bff] text-white"
              : "bg-white text-slate-600 border border-slate-200"
          }`}
        >
          <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
          {label}
        </Link>
      ))}
      <Link
        href={settingsLink.href}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
          isDashboardNavActive(pathname, settingsLink.href, settingsLink.exact)
            ? "bg-[#007bff] text-white"
            : "bg-white text-slate-600 border border-slate-200"
        }`}
      >
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">
          {settingsLink.icon}
        </span>
        {settingsLink.label}
      </Link>
    </nav>
  );
}

function SidebarLink({
  href,
  label,
  exact,
  icon,
  pathname,
}: {
  href: string;
  label: string;
  exact: boolean;
  icon: ReactNode;
  pathname: string;
}) {
  const active = isDashboardNavActive(pathname, href, exact);
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-[#007bff] text-white shadow-sm shadow-blue-500/20"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <span
        className={
          active ? "text-white/90" : "text-slate-400 group-hover:text-slate-600"
        }
      >
        {icon}
      </span>
      {label}
    </Link>
  );
}
