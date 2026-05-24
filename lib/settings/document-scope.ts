import { documents } from "@/db/schema";
import { documentsUploadedByUser } from "@/lib/dashboard/document-ownership";
import type { SQL } from "drizzle-orm";
import type { DocumentScope, UserPreferences } from "./preferences";

type Viewer = {
  id: string;
  email: string;
  role?: string | null;
};

export function canUseTenantDocumentScope(role: string | null | undefined): boolean {
  return role === "admin" || role === "assessor";
}

/** Effective scope after role checks. */
export function resolveDocumentScope(
  prefs: UserPreferences,
  role: string | null | undefined
): DocumentScope {
  if (prefs.documentScope === "tenant" && canUseTenantDocumentScope(role)) {
    return "tenant";
  }
  return "mine";
}

/** SQL filter for document queries; `undefined` = all tenant documents. */
export function documentScopeFilter(
  viewer: Viewer,
  prefs: UserPreferences
): SQL | undefined {
  const scope = resolveDocumentScope(prefs, viewer.role);
  if (scope === "tenant") return undefined;
  return documentsUploadedByUser(viewer);
}
