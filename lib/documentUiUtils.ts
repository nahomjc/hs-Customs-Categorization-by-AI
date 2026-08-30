/** Visual helpers for document results UI */

export type HsBadgeTone = {
  bg: string;
  border: string;
  text: string;
  dot: string;
};

const CHAPTER_TONES: Record<string, HsBadgeTone> = {
  "01": { bg: "bg-emerald-50", border: "border-emerald-200/80", text: "text-emerald-800", dot: "bg-emerald-500" },
  "02": { bg: "bg-green-50", border: "border-green-200/80", text: "text-green-800", dot: "bg-green-500" },
  "15": { bg: "bg-amber-50", border: "border-amber-200/80", text: "text-amber-900", dot: "bg-amber-500" },
  "39": { bg: "bg-cyan-50", border: "border-cyan-200/80", text: "text-cyan-900", dot: "bg-cyan-500" },
  "67": { bg: "bg-lime-50", border: "border-lime-200/80", text: "text-lime-900", dot: "bg-lime-500" },
  "85": { bg: "bg-violet-50", border: "border-violet-200/80", text: "text-violet-900", dot: "bg-violet-500" },
  "94": { bg: "bg-indigo-50", border: "border-indigo-200/80", text: "text-indigo-900", dot: "bg-indigo-500" },
};

const DEFAULT_TONE: HsBadgeTone = {
  bg: "bg-slate-50",
  border: "border-slate-200/80",
  text: "text-slate-800",
  dot: "bg-slate-400",
};

export function hsBadgeTone(hsCode: string | null | undefined): HsBadgeTone {
  if (!hsCode || hsCode === "—") return DEFAULT_TONE;
  const digits = hsCode.replace(/\D/g, "");
  const chapter = digits.slice(0, 2);
  return CHAPTER_TONES[chapter] ?? DEFAULT_TONE;
}

export function fileTypeLabel(name: string | null): string {
  if (!name) return "Document";
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "PDF";
    case "xlsx":
    case "xls":
      return "Excel";
    case "csv":
      return "CSV";
    case "docx":
      return "Word";
    default:
      return ext?.toUpperCase() ?? "File";
  }
}

export function fileTypeIconColor(name: string | null): string {
  const ext = name?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "from-rose-500 to-orange-500";
    case "xlsx":
    case "xls":
      return "from-emerald-500 to-teal-500";
    case "csv":
      return "from-indigo-500 to-violet-500";
    case "docx":
      return "from-blue-500 to-cyan-500";
    default:
      return "from-slate-500 to-slate-600";
  }
}
