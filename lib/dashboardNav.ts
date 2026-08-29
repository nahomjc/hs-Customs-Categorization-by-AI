/**
 * Normalizes app paths for consistent nav matching (trailing slashes, aliases).
 */
export function normalizeDashboardPath(pathname: string): string {
  if (!pathname) return "/dashboard";
  const path = pathname.split("?")[0].split("#")[0];
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

/** Maps nested routes to their parent nav item. */
function resolveNavPath(path: string): string {
  if (path.startsWith("/dashboard/documents")) {
    return "/dashboard/history";
  }
  if (path.startsWith("/dashboard/users")) {
    return "/dashboard/users";
  }
  return path;
}

export function isDashboardNavActive(
  pathname: string,
  href: string,
  exact = false,
): boolean {
  const path = resolveNavPath(normalizeDashboardPath(pathname));
  const target = normalizeDashboardPath(href);

  if (exact) {
    return path === target;
  }

  return path === target || path.startsWith(`${target}/`);
}
