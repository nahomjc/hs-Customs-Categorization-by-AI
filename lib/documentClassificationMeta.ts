export type DocumentClassificationMeta = {
  source: "document";
  documentHs: string;
  normalizedHs: string;
  reviewRecommended: boolean;
  reviewReasons: string[];
  tariffNo?: string;
  dutyRate?: string;
  stdUnit?: string;
  referenceDescription?: string;
};

export function parseDocumentClassificationMeta(
  raw: string | null | undefined,
): DocumentClassificationMeta | null {
  if (!raw?.trim()) return null;
  try {
    const p = JSON.parse(raw) as DocumentClassificationMeta;
    if (p.source === "document") return p;
  } catch {
    return null;
  }
  return null;
}
