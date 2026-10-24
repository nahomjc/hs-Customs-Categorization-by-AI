/** Helpers for the read-only "extra" columns kept from spreadsheet imports. */

export type ExtraValues = Record<string, string> | null | undefined;

/** Ordered union of extra keys across lines (first-seen order). */
export function collectExtraKeys(values: ExtraValues[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const extra of values) {
    if (!extra || typeof extra !== "object") continue;
    for (const key of Object.keys(extra)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}
