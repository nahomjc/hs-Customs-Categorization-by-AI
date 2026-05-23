/** Harmonized System code parsing and normalization. */

export const HS_CODE_REGEX = /\b(\d{4})\.(\d{2,4})\b/;
const HS_SPACED_REGEX = /\b(\d{4})\s+(\d{2,4})\b/;
const HS_BARE_8_REGEX = /\b(\d{4})(\d{4})\b/;

const UNIT_TOKENS =
  /^(CTNS?|CARTONS?|PCS?|PC|PIECES?|SETS?|SET|UNITS?|BOX(?:ES)?|ROLLS?|KG|KGS?)$/i;

export type NormalizedHs = {
  /** Full code for display/export (e.g. 8516.7900) */
  display: string;
  /** Key for grouping (same as display for pre-coded lists) */
  groupingKey: string;
  chapter: string;
  heading: string;
};

export function isHsCodeFormat(code: string | null | undefined): boolean {
  if (!code?.trim()) return false;
  const n = normalizeHsCode(code);
  return n !== null;
}

/** Reject OCR false positives (invoice dates, years in subheading). */
export function isPlausibleHsCode(raw: string | null | undefined): boolean {
  const n = normalizeHsCode(raw);
  if (!n) return false;

  const chapter = Number.parseInt(n.chapter, 10);
  if (chapter < 1 || chapter > 97) return false;

  const headingNum = Number.parseInt(n.heading, 10);
  if (headingNum >= 2020 && headingNum <= 2035) return false;

  const sub = n.display.includes(".") ? n.display.split(".")[1] ?? "" : "";
  if (/^202[4-9]\d{0,2}$/.test(sub) || /^20[3-9]\d$/.test(sub)) return false;

  return true;
}

export function normalizeHsCode(
  raw: string | null | undefined
): NormalizedHs | null {
  if (!raw?.trim()) return null;
  const cleaned = raw.trim().replace(/\s/g, "");
  const dotted = cleaned.match(/^(\d{4})\.(\d{2,4})$/);
  if (dotted) {
    const heading = dotted[1];
    const sub = dotted[2].padEnd(4, "0").slice(0, 4);
    const display = `${heading}.${sub}`;
    return {
      display,
      groupingKey: display,
      chapter: heading.slice(0, 2),
      heading,
    };
  }
  const bare = cleaned.match(/^(\d{4})(\d{2,4})$/);
  if (bare) {
    return normalizeHsCode(`${bare[1]}.${bare[2]}`);
  }
  const headingOnly = cleaned.match(/^(\d{4})$/);
  if (headingOnly) {
    const heading = headingOnly[1];
    return {
      display: heading,
      groupingKey: heading,
      chapter: heading.slice(0, 2),
      heading,
    };
  }
  return null;
}

/** Normalize common OCR spacing / missing dots before parsing. */
export function preprocessPackingListOcr(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/(\d{4})\s+(\d{2,4})(?!\d)/g, "$1.$2")
    .replace(/\b(\d{4})(\d{4})\b/g, (full, h, sub) => {
      const chapter = Number.parseInt(h.slice(0, 2), 10);
      if (chapter < 1 || chapter > 97) return full;
      const n = normalizeHsCode(`${h}.${sub}`);
      return n ? n.display : full;
    });
}

export function countHsCodesInText(text: string): number {
  const pre = preprocessPackingListOcr(text);
  const keys = new Set<string>();
  for (const m of pre.matchAll(/\b\d{4}\.\d{2,4}\b/g)) {
    if (!isPlausibleHsCode(m[0])) continue;
    const n = normalizeHsCode(m[0]);
    if (n) keys.add(n.groupingKey);
  }
  return keys.size;
}

function pickHsCandidate(code: string): string | null {
  if (!isPlausibleHsCode(code)) return null;
  const n = normalizeHsCode(code);
  return n?.display ?? null;
}

export function extractHsFromLine(line: string): string | null {
  const dotted = line.match(HS_CODE_REGEX);
  if (dotted) {
    return pickHsCandidate(`${dotted[1]}.${dotted[2]}`);
  }
  const spaced = line.match(HS_SPACED_REGEX);
  if (spaced) {
    return pickHsCandidate(`${spaced[1]}.${spaced[2]}`);
  }
  const bare = line.match(HS_BARE_8_REGEX);
  if (bare) {
    return pickHsCandidate(`${bare[1]}${bare[2]}`);
  }
  return null;
}
