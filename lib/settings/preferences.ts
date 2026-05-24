/** Per-user preferences stored in `settings.preferences` (jsonb). */

export type ExportFormat = "xlsx" | "csv";
export type ClassificationModePreference = "auto" | "ai" | "pre_coded";
export type DocumentScope = "mine" | "tenant";
export type AnalyticsRangePreset = "7d" | "30d" | "90d" | "month";
export type HistoryPageSize = 25 | 50 | 100;

export type UserPreferences = {
  /** Email when a document finishes classification. */
  emailOnComplete: boolean;
  /** Email when processing fails. */
  emailOnFailure: boolean;
  /** Navigate to the document after a successful upload. */
  autoOpenDocument: boolean;
  /** Default download format for categorized exports. */
  defaultExportFormat: ExportFormat;
  /**
   * Upload classification: `auto` detects HS codes in the file;
   * `ai` / `pre_coded` force a mode when detection is ambiguous.
   */
  defaultClassificationMode: ClassificationModePreference;
  /** History & dashboard: your uploads vs all tenant documents (admins/assessors). */
  documentScope: DocumentScope;
  /** User list: include inactive accounts. */
  showInactiveUsers: boolean;
  /** Max rows loaded on the history page (server-side). */
  historyPageSize: HistoryPageSize;
  /** Default analytics date range when URL has no `from`/`to`. */
  defaultAnalyticsRange: AnalyticsRangePreset;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  emailOnComplete: true,
  emailOnFailure: true,
  autoOpenDocument: true,
  defaultExportFormat: "xlsx",
  defaultClassificationMode: "auto",
  documentScope: "mine",
  showInactiveUsers: false,
  historyPageSize: 50,
  defaultAnalyticsRange: "30d",
};

export const DEFAULT_PREFERENCES_JSON = DEFAULT_PREFERENCES as Record<
  string,
  unknown
>;

const HISTORY_PAGE_SIZES = new Set<HistoryPageSize>([25, 50, 100]);
const ANALYTICS_PRESETS = new Set<AnalyticsRangePreset>([
  "7d",
  "30d",
  "90d",
  "month",
]);

function pickBoolean(
  value: unknown,
  fallback: boolean
): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Parse preferences from jsonb or legacy `users.meta.preferences`. */
export function parsePreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PREFERENCES };
  }

  const root = raw as Record<string, unknown>;
  const prefs =
    root.preferences && typeof root.preferences === "object"
      ? (root.preferences as Record<string, unknown>)
      : root;

  const pageSize = Number(prefs.historyPageSize);
  const historyPageSize = HISTORY_PAGE_SIZES.has(pageSize as HistoryPageSize)
    ? (pageSize as HistoryPageSize)
    : DEFAULT_PREFERENCES.historyPageSize;

  const analytics = prefs.defaultAnalyticsRange;
  const defaultAnalyticsRange = ANALYTICS_PRESETS.has(
    analytics as AnalyticsRangePreset
  )
    ? (analytics as AnalyticsRangePreset)
    : DEFAULT_PREFERENCES.defaultAnalyticsRange;

  const classification = prefs.defaultClassificationMode;
  const defaultClassificationMode =
    classification === "ai" ||
    classification === "pre_coded" ||
    classification === "auto"
      ? classification
      : DEFAULT_PREFERENCES.defaultClassificationMode;

  const scope = prefs.documentScope;
  const documentScope =
    scope === "tenant" || scope === "mine"
      ? scope
      : DEFAULT_PREFERENCES.documentScope;

  return {
    emailOnComplete: pickBoolean(
      prefs.emailOnComplete,
      DEFAULT_PREFERENCES.emailOnComplete
    ),
    emailOnFailure: pickBoolean(
      prefs.emailOnFailure,
      DEFAULT_PREFERENCES.emailOnFailure
    ),
    autoOpenDocument: pickBoolean(
      prefs.autoOpenDocument,
      DEFAULT_PREFERENCES.autoOpenDocument
    ),
    defaultExportFormat:
      prefs.defaultExportFormat === "csv" ? "csv" : "xlsx",
    defaultClassificationMode,
    documentScope,
    showInactiveUsers: pickBoolean(
      prefs.showInactiveUsers,
      DEFAULT_PREFERENCES.showInactiveUsers
    ),
    historyPageSize,
    defaultAnalyticsRange,
  };
}

/** Merge partial updates onto existing preferences. */
export function mergePreferences(
  current: UserPreferences,
  patch: Partial<UserPreferences>
): UserPreferences {
  const next = { ...current, ...patch };

  if (patch.defaultExportFormat !== undefined) {
    next.defaultExportFormat =
      patch.defaultExportFormat === "csv" ? "csv" : "xlsx";
  }

  if (patch.historyPageSize !== undefined) {
    const n = patch.historyPageSize;
    next.historyPageSize = HISTORY_PAGE_SIZES.has(n) ? n : current.historyPageSize;
  }

  if (patch.defaultAnalyticsRange !== undefined) {
    const p = patch.defaultAnalyticsRange;
    next.defaultAnalyticsRange = ANALYTICS_PRESETS.has(p)
      ? p
      : current.defaultAnalyticsRange;
  }

  if (patch.defaultClassificationMode !== undefined) {
    const m = patch.defaultClassificationMode;
    next.defaultClassificationMode =
      m === "ai" || m === "pre_coded" || m === "auto"
        ? m
        : current.defaultClassificationMode;
  }

  if (patch.documentScope !== undefined) {
    next.documentScope =
      patch.documentScope === "tenant" ? "tenant" : "mine";
  }

  return next;
}

/** Restrict management-only prefs for non-admin/non-assessor roles. */
export function clampPreferencesForRole(
  prefs: UserPreferences,
  role: string | null | undefined
): UserPreferences {
  const canManage =
    role === "admin" || role === "assessor";
  if (canManage) return prefs;
  return {
    ...prefs,
    documentScope: "mine",
    showInactiveUsers: false,
  };
}
