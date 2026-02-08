import mammoth from "mammoth";
import * as XLSX from "xlsx";

export type FileType = "pdf" | "docx" | "xlsx";

export async function extractTextFromBuffer(
  buffer: Buffer,
  fileType: FileType
): Promise<string> {
  if (fileType === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (fileType === "xlsx") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        defval: "",
      });
      for (const row of data) {
        const rowText = Array.isArray(row)
          ? row.map((c) => String(c ?? "")).join("\t")
          : String(row);
        if (rowText.trim()) lines.push(rowText.trim());
      }
    }
    return lines.join("\n");
  }

  if (fileType === "pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      const text = data?.text?.trim() ?? "";
      if (!text) {
        console.error(
          "[HS extractText] PDF has no extractable text (image-only or scanned?)"
        );
        throw new Error(
          "PDF has no extractable text (e.g. image-only or scanned). Try exporting as text-based PDF or use a DOCX file."
        );
      }
      console.log(
        "[HS extractText] PDF extracted OK | text length:",
        text.length,
        "| first 80 chars:",
        text.slice(0, 80)
      );
      return text;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[HS extractText] PDF extraction failed:", msg);
      throw new Error("PDF text extraction failed: " + msg);
    }
  }

  throw new Error("Unsupported file type: " + fileType);
}
