import { z } from "zod";

export const lineMatchSchema = z.object({
  invoiceLineId: z.string().uuid(),
  packingListLineId: z.string().uuid(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

export const matchResultSchema = z.object({
  matches: z.array(lineMatchSchema),
  unmatchedInvoiceLineIds: z.array(z.string().uuid()),
  unmatchedPackingListLineIds: z.array(z.string().uuid()),
});

export type LineMatch = z.infer<typeof lineMatchSchema>;
export type MatchResult = z.infer<typeof matchResultSchema>;

export type InvoiceLineInput = {
  id: string;
  lineNumber: number;
  supplierDescription: string;
  supplierSku: string | null;
  brand: string | null;
  modelNumber: string | null;
  quantity: string;
  unitOfMeasure: string;
};

export type PackingLineInput = {
  id: string;
  lineNumber: number;
  supplierDescription: string;
  supplierSku: string | null;
  brand: string | null;
  modelNumber: string | null;
  quantity: string;
  unitOfMeasure: string;
};

function normalizeSku(sku: string | null): string {
  return (sku ?? "").trim().toLowerCase();
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}

function descriptionSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap++;
  }
  return overlap / Math.max(ta.size, tb.size);
}

/** Rule-based matching: SKU → line number → description similarity */
export function matchInvoiceAndPackingLines(
  invoiceLines: InvoiceLineInput[],
  packingLines: PackingLineInput[],
): MatchResult {
  const matches: LineMatch[] = [];
  const usedInvoice = new Set<string>();
  const usedPacking = new Set<string>();

  // Pass 1: exact SKU match
  for (const inv of invoiceLines) {
    const sku = normalizeSku(inv.supplierSku);
    if (!sku) continue;
    const pack = packingLines.find(
      (p) =>
        !usedPacking.has(p.id) && normalizeSku(p.supplierSku) === sku,
    );
    if (pack) {
      matches.push({
        invoiceLineId: inv.id,
        packingListLineId: pack.id,
        confidence: 0.95,
        reason: `SKU match: ${inv.supplierSku}`,
      });
      usedInvoice.add(inv.id);
      usedPacking.add(pack.id);
    }
  }

  // Pass 2: same line number
  for (const inv of invoiceLines) {
    if (usedInvoice.has(inv.id)) continue;
    const pack = packingLines.find(
      (p) => !usedPacking.has(p.id) && p.lineNumber === inv.lineNumber,
    );
    if (pack) {
      matches.push({
        invoiceLineId: inv.id,
        packingListLineId: pack.id,
        confidence: 0.8,
        reason: `Line number match: ${inv.lineNumber}`,
      });
      usedInvoice.add(inv.id);
      usedPacking.add(pack.id);
    }
  }

  // Pass 3: description similarity >= 0.35
  for (const inv of invoiceLines) {
    if (usedInvoice.has(inv.id)) continue;
    let best: { pack: PackingLineInput; score: number } | null = null;
    for (const pack of packingLines) {
      if (usedPacking.has(pack.id)) continue;
      const score = descriptionSimilarity(
        inv.supplierDescription,
        pack.supplierDescription,
      );
      if (score >= 0.35 && (!best || score > best.score)) {
        best = { pack, score };
      }
    }
    if (best) {
      matches.push({
        invoiceLineId: inv.id,
        packingListLineId: best.pack.id,
        confidence: Math.min(0.75, 0.45 + best.score * 0.4),
        reason: `Description similarity (${(best.score * 100).toFixed(0)}%)`,
      });
      usedInvoice.add(inv.id);
      usedPacking.add(best.pack.id);
    }
  }

  return {
    matches,
    unmatchedInvoiceLineIds: invoiceLines
      .filter((l) => !usedInvoice.has(l.id))
      .map((l) => l.id),
    unmatchedPackingListLineIds: packingLines
      .filter((l) => !usedPacking.has(l.id))
      .map((l) => l.id),
  };
}
