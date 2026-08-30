export type HsReferenceSortField =
  | "tariffNo"
  | "hsCode"
  | "description"
  | "chapter"
  | "heading"
  | "dutyRate"
  | "importedAt";

export type HsReferenceListParams = {
  q?: string;
  chapter?: string;
  sortBy?: HsReferenceSortField;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type HsReferenceStats = {
  rowCount: number;
  chapters: string[];
  chapterRange: string | null;
  lastImportedAt: string | null;
  storageBytes: number;
};
