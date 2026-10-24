/**
 * Pure planning for product harmonization (no DB, no AI).
 *
 * The plan is a deterministic, ordered list of "slots". Slot N becomes the
 * product with product_sequence N. Because the plan only depends on the source
 * lines, every request can rebuild it, so work can be split into short,
 * resumable batches and a retried batch never creates duplicates.
 */
import {
  matchInvoiceAndPackingLines,
  type InvoiceLineInput,
  type PackingLineInput,
} from "./match-lines";

export type HarmonizeSlot<I, P> = {
  /** 1-based; equals import_products.product_sequence. */
  sequence: number;
  inv?: I;
  pack?: P;
  matchConfidence?: number;
  status: "ready_for_hs_suggestion" | "needs_information";
  missingInfo: string[];
};

export type HarmonizePlan<I, P> = {
  slots: HarmonizeSlot<I, P>[];
  matchCount: number;
  unmatchedInvoiceCount: number;
  unmatchedPackingCount: number;
  /** Changes whenever the set or order of slots changes. */
  planKey: string;
};

/** FNV-1a (32-bit) over the parts; enough to detect a changed plan. */
export function stableHash(parts: readonly string[]): string {
  let h = 0x811c9dc5;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      h ^= part.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= 0x7c; // separator
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function buildHarmonizePlan<
  I extends InvoiceLineInput & { id: string },
  P extends PackingLineInput & { id: string },
>(invRows: I[], packRows: P[]): HarmonizePlan<I, P> {
  const matchResult = matchInvoiceAndPackingLines(invRows, packRows);
  const invById = new Map(invRows.map((r) => [r.id, r]));
  const packById = new Map(packRows.map((r) => [r.id, r]));

  const slots: HarmonizeSlot<I, P>[] = [];
  let sequence = 0;

  // Matched pairs
  for (const match of matchResult.matches) {
    const inv = invById.get(match.invoiceLineId);
    const pack = packById.get(match.packingListLineId);
    if (!inv) continue;
    const qtyMismatch = pack && Number(inv.quantity) !== Number(pack.quantity);
    sequence += 1;
    slots.push({
      sequence,
      inv,
      pack,
      matchConfidence: match.confidence,
      status: qtyMismatch ? "needs_information" : "ready_for_hs_suggestion",
      missingInfo: qtyMismatch ? ["quantity_mismatch_between_sources"] : [],
    });
  }

  // Unmatched invoice lines
  for (const id of matchResult.unmatchedInvoiceLineIds) {
    const inv = invById.get(id);
    if (!inv) continue;
    sequence += 1;
    slots.push({
      sequence,
      inv,
      status: "needs_information",
      missingInfo: ["no_packing_list_match"],
    });
  }

  // Unmatched packing lines
  for (const id of matchResult.unmatchedPackingListLineIds) {
    const pack = packById.get(id);
    if (!pack) continue;
    sequence += 1;
    slots.push({
      sequence,
      pack,
      status: "needs_information",
      missingInfo: ["no_invoice_match"],
    });
  }

  return {
    slots,
    matchCount: matchResult.matches.length,
    unmatchedInvoiceCount: matchResult.unmatchedInvoiceLineIds.length,
    unmatchedPackingCount: matchResult.unmatchedPackingListLineIds.length,
    planKey: stableHash(
      slots.map((s) => `${s.sequence}:${s.inv?.id ?? ""}:${s.pack?.id ?? ""}`),
    ),
  };
}

/** Split items into chunks of at most `size` (size < 1 is treated as 1). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size) || 1);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

/** 1..total as an array (empty for total < 1). */
export function sequenceRange(total: number): number[] {
  const n = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  return Array.from({ length: n }, (_, i) => i + 1);
}

/** Run `fn` over items with at most `limit` in flight; results keep input order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(Math.floor(limit) || 1, items.length)) },
    async () => {
      while (true) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await fn(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}