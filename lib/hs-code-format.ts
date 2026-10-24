/**
 * One display format for HS codes, and completion of short codes against the
 * tariff book. Pure module (no database): the caller passes the book rows.
 *
 * - 8+ digits  -> "XXXX.XXXX" (complete)
 * - 6 digits   -> "XXXX.XX"   (incomplete)
 * - 4 digits   -> "XXXX"      (incomplete)
 */

export type HsCodeDisplay = {
  /** Consistent text, or the original text when it holds no usable digits. */
  display: string;
  /** All digits of the code (max 10). */
  digits: string;
  /** True when the code has fewer than 8 digits. */
  incomplete: boolean;
};

export function hsDigits(code: string | null | undefined): string {
  return (code ?? "").replace(/\D/g, "").slice(0, 10);
}

export function formatHsCode(code: string | null | undefined): HsCodeDisplay {
  const digits = hsDigits(code);
  if (digits.length >= 8) {
    return { display: `${digits.slice(0, 4)}.${digits.slice(4, 8)}`, digits, incomplete: false };
  }
  if (digits.length >= 6) {
    return { display: `${digits.slice(0, 4)}.${digits.slice(4, 6)}`, digits, incomplete: true };
  }
  if (digits.length >= 4) {
    return { display: digits.slice(0, 4), digits, incomplete: true };
  }
  return { display: (code ?? "").trim(), digits, incomplete: digits.length > 0 };
}

type BookRow = { normalizedHs: string | null; hsCode: string | null; tariffNo: string };

function fullDigitsOf(row: BookRow): string {
  return hsDigits(row.normalizedHs ?? row.hsCode ?? row.tariffNo);
}

/**
 * A 4 or 6 digit code becomes the full 8 digit code when the tariff book has
 * exactly ONE full code under it (for example 1601 -> 1601.0000 when 1601 has no
 * subdivision). When the book has several, the code stays short and incomplete:
 * nothing is guessed.
 */
export function completeHsCode(
  code: string | null | undefined,
  bookRows: readonly BookRow[],
): HsCodeDisplay & { completed: boolean } {
  const base = formatHsCode(code);
  if (!base.incomplete || base.digits.length < 4) return { ...base, completed: false };

  const full = new Set<string>();
  for (const row of bookRows) {
    const d = fullDigitsOf(row);
    if (d.length === 8 && d.startsWith(base.digits)) full.add(d);
  }
  if (full.size === 1) {
    const only = [...full][0];
    return { ...formatHsCode(only), completed: true };
  }
  return { ...base, completed: false };
}