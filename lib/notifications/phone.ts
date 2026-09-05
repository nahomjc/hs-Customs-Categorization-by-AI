/** Normalize Ethiopian phone numbers to 251XXXXXXXXX. */
export function normalizeEthiopiaPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;

  let normalized = digits;
  if (normalized.startsWith("0") && normalized.length === 10) {
    normalized = `251${normalized.slice(1)}`;
  } else if (normalized.startsWith("9") && normalized.length === 9) {
    normalized = `251${normalized}`;
  } else if (normalized.startsWith("251") && normalized.length === 12) {
    // already ok
  } else if (normalized.length === 12 && normalized.startsWith("251")) {
    // ok
  } else {
    return null;
  }

  if (!/^251[79]\d{8}$/.test(normalized)) return null;
  return normalized;
}
