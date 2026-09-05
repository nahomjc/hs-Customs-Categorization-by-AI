export const USER_ROLES = ["admin", "assessor", "user", "client"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  assessor: "Assessor",
  user: "User",
  client: "Client",
};

export const STAFF_ROLES = ["admin", "assessor", "user"] as const;

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function isStaffRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "assessor" || role === "user";
}

export function isClientRole(role: string | null | undefined): boolean {
  return role === "client";
}
