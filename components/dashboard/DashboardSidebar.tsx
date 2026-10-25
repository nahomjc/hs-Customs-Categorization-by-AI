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
  demoRequests: (
    <NavIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z"
      />
    </NavIcon>
  ),
  suppliers: (
    <NavIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"
      />
    </NavIcon>
  ),
  notifications: (
    <NavIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
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
];

export const usersNavLink: NavLink = {
  href: "/dashboard/users",
  label: "User list",
  exact: false,
  icon: icons.users,
};

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
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    exact: false,
    icon: icons.notifications,
  },
];

export const adminNavLink: NavLink = {
  href: "/dashboard/hs-reference",
  label: "HS reference",
  exact: false,
  icon: icons.hsReference,
};

export const demoRequestsNavLink: NavLink = {
  href: "/dashboard/demo-requests",
  label: "Demo requests",
  exact: false,
  icon: icons.demoRequests,
};

export const suppliersNavLink: NavLink = {
  href: "/dashboard/suppliers",
  label: "Suppliers",
  exact: false,
  icon: icons.suppliers,
};

export const vddNavLink: NavLink = {
  href: "/dashboard/vdd",
  label: "VDD import",
  exact: false,
  icon: icons.vdd,
};

export const hsCodeSearchNavLink: NavLink = {
  href: "/dashboard/tools/hs-code-search",
  label: "HS code search",
  exact: false,
  icon: icons.hsSearch,
};

export const settingsLink: NavLink = {
  href: "/dashboard/settings",
  label: "Settings",
  exact: true,
  icon: icons.settings,
};

export type NavGroup = {
  id: string;
  label: string;
  links: NavLink[];
};

export type DashboardNavOptions = {
  isAdmin?: boolean;
  isAssessor?: boolean;
  isClient?: boolean;
  canViewUsers?: boolean;
};

export function getDashboardNavGroups(
  options: DashboardNavOptions,
): NavGroup[] {
  if (options.isClient) {
    return [
      {
        id: "overview",
        label: "Overview",
        links: clientNavLinks,
      },
    ];
  }

  const workflowLinks: NavLink[] = [mainNavLinks[1]];
  if (!options.isAdmin) {
    workflowLinks.push(mainNavLinks[3], mainNavLinks[4]);
  }

  const groups: NavGroup[] = [
    {
      id: "overview",
      label: "Overview",
      links: [mainNavLinks[0]],
    },
    {
      id: "workflow",
      label: "Classification workflow",
      links: workflowLinks,
    },
    {
      id: "insights",
      label: "Insights",
      links: [mainNavLinks[2]],
    },
  ];

  const toolLinks: NavLink[] = [];
  if (options.isAdmin || options.isAssessor) {
    toolLinks.push(hsCodeSearchNavLink);
  }
  if (toolLinks.length > 0) {
    groups.push({
      id: "tools",
      label: "Reference & tools",
      links: toolLinks,
    });
  }

  const managementLinks: NavLink[] = [];
  if (options.canViewUsers) {
    managementLinks.push(usersNavLink);
  }
  if (options.isAdmin) {
    managementLinks.push(
      suppliersNavLink,
      demoRequestsNavLink,
      adminNavLink,
      vddNavLink,
    );
  }
  if (managementLinks.length > 0) {
    groups.push({
      id: "management",
      label: "Management",
      links: managementLinks,
    });
  }

  return groups;
}

export function getDashboardNavLinks(options: DashboardNavOptions): NavLink[] {
  return getDashboardNavGroups(options).flatMap((g) => g.links);
}

export function DashboardSidebar({
  isAdmin = false,
  isAssessor = false,
  isClient = false,
  canViewUsers = false,
}: {
  isAdmin?: boolean;
  isAssessor?: boolean;
  isClient?: boolean;
  canViewUsers?: boolean;
}) {
  const pathname = usePathname();
  const groups = getDashboardNavGroups({
    isAdmin,
    isAssessor,
    isClient,
    canViewUsers,
  });

  return (
    <aside className="hidden lg:flex w-[17rem] shrink-0 flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white sticky top-[4.5rem] max-h-[calc(100vh-6rem)] lg:ml-3">
      <div className="border-b border-slate-200/25 bg-linear-to-br from-slate-50/80 via-white to-blue-50/30 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#007bff]/10 text-[#007bff]">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              role="img"
              aria-label="Navigation menu"
            >
              <title>Navigation menu</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h10M4 18h6"
              />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Workspace
            </p>
            <p className="truncate text-sm font-semibold text-slate-900">
              {isClient ? "Shipment tracking" : "HS classification"}
            </p>
          </div>
        </div>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        aria-label="Dashboard"
      >
        <div className="flex-1 overflow-y-auto px-2 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {groups.map((group, groupIndex) => (
            <div
              key={group.id}
              className={
                groupIndex > 0 ? "mt-5 border-t border-slate-200/25 pt-4" : ""
              }
            >
              <p
                className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400"
                id={`nav-group-${group.id}`}
              >
                {group.label}
              </p>
              <ul
                className="space-y-0.5"
                aria-labelledby={`nav-group-${group.id}`}
              >
                {group.links.map(({ href, label, exact, icon }) => (
                  <li key={href}>
                    <SidebarLink
                      href={href}
                      label={label}
                      exact={exact}
                      icon={icon}
                      pathname={pathname}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="shrink-0 border-t border-slate-100 bg-slate-50/40 px-2 py-3">
          <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Account
          </p>
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
  canViewUsers = false,
}: {
  isAdmin?: boolean;
  isAssessor?: boolean;
  isClient?: boolean;
  canViewUsers?: boolean;
}) {
  const pathname = usePathname();
  const links = getDashboardNavLinks({
    isAdmin,
    isAssessor,
    isClient,
    canViewUsers,
  });

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
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{settingsLink.icon}</span>
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
      className={`group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-[#007bff] text-white"
          : "text-slate-600 hover:bg-white hover:text-slate-900"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
          active
            ? "bg-white/15 text-white"
            : "bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-[#007bff]"
        }`}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
