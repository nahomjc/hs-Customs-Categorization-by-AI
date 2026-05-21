export type UserPreferences = {
  emailOnComplete: boolean;
  defaultExportFormat: "xlsx" | "csv";
  autoOpenDocument: boolean;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  emailOnComplete: true,
  defaultExportFormat: "xlsx",
  autoOpenDocument: true,
};

export function parsePreferences(meta: unknown): UserPreferences {
  if (!meta || typeof meta !== "object") return { ...DEFAULT_PREFERENCES };
  const prefs = (meta as { preferences?: unknown }).preferences;
  if (!prefs || typeof prefs !== "object") return { ...DEFAULT_PREFERENCES };
  const p = prefs as Partial<UserPreferences>;
  return {
    emailOnComplete:
      typeof p.emailOnComplete === "boolean"
        ? p.emailOnComplete
        : DEFAULT_PREFERENCES.emailOnComplete,
    defaultExportFormat:
      p.defaultExportFormat === "csv" ? "csv" : "xlsx",
    autoOpenDocument:
      typeof p.autoOpenDocument === "boolean"
        ? p.autoOpenDocument
        : DEFAULT_PREFERENCES.autoOpenDocument,
  };
}
