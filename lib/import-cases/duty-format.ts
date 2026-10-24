/**
 * One display format for duty rates. The tariff book mixes "30%", "0.35"
 * (a fraction), "Free" and numbers like "20". Everything becomes "30%" or
 * "Free". Client-safe, pure.
 */

export type DutyRateParts = {
  /** "35%", "Free", or "" when there is no rate. */
  display: string;
  /** Rate in percent (35 for 35%), or null when there is no rate. */
  percent: number | null;
};

const FREE_RE = /^(?:free|nil|exempt|duty[\s-]*free|zero)$/i;

function formatPercent(n: number): string {
  return `${Number.parseFloat(n.toFixed(4))}%`;
}

/**
 * Rules: text with "%" is a percent; "free"/"nil"/"exempt" is Free (0%); a plain
 * number below 1 is a fraction of 1 (0.35 is 35%); a plain number of 1 or more is
 * already a percent (20 is 20%).
 */
export function normalizeDutyRate(raw: string | number | null | undefined): DutyRateParts {
  if (raw === null || raw === undefined) return { display: "", percent: null };
  const text = String(raw).trim();
  if (!text) return { display: "", percent: null };
  if (FREE_RE.test(text)) return { display: "Free", percent: 0 };

  // anything else ("5% + 10 USD/kg") is not a plain rate: leave it to the caller
  if (!/^[\d.,]+\s*%?$/.test(text)) return { display: "", percent: null };

  const hasPercent = text.includes("%");
  const n = Number.parseFloat(text.replace(/%/g, "").replace(/,/g, ".").trim());
  if (!Number.isFinite(n) || n < 0) return { display: "", percent: null };

  if (hasPercent) return { display: n === 0 ? "0%" : formatPercent(n), percent: n };
  if (n === 0) return { display: "0%", percent: 0 };
  const percent = n < 1 ? Number.parseFloat((n * 100).toFixed(4)) : n;
  return { display: formatPercent(percent), percent };
}