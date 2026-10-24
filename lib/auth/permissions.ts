/**
 * Dashboard route and feature permissions by role.
 * APIs should mirror these rules (requireAdmin, requireAdminOrAssessor, etc.).
 */

import { isClientRole, isStaffRole, type UserRole } from "./roles";

export function canViewUserList(role: string | null | undefined): boolean {
  return role === "admin" || role === "assessor";
}

/** Invite users, change roles, verification flags. */
export function canManageUsers(role: string | null | undefined): boolean {
  return role === "admin";
}

export function canAccessHsReference(role: string | null | undefined): boolean {
  return role === "admin";
}

export function canAccessHsCodeSearch(role: string | null | undefined): boolean {
  return role === "admin" || role === "assessor";
}

export function canAccessChannelsSettings(
  role: string | null | undefined
): boolean {
  return role === "admin";
}

export function canAccessVddImport(role: string | null | undefined): boolean {
  return role === "admin";
}

export function canAccessStaffDashboard(role: string | null | undefined): boolean {
  return isStaffRole(role);
}

export { isClientRole, isStaffRole, type UserRole };
