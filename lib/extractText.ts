import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { extractPdfTextViaOpenRouter } from "./extractPdfOcr";

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
    let text = "";
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      text = data?.text?.trim() ?? "";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[HS extractText] pdf-parse failed:", msg);
    }

    if (text) {
      console.log(
        "[HS extractText] PDF extracted OK | text length:",
        text.length,
        "| first 80 chars:",
        text.slice(0, 80)
      );
      return text;
    }

    console.log(
      "[HS extractText] No embedded PDF text; trying OpenRouter OCR (scanned/image PDF)…"
    );
    try {
      return await extractPdfTextViaOpenRouter(buffer);
    } catch (ocrErr) {
      const ocrMsg = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
      console.error("[HS extractText] PDF OCR failed:", ocrMsg);
      throw new Error(
        `Could not read this PDF. It may be scanned or image-only. Ensure OPENROUTER_API_KEY is set, or upload a text-based PDF / DOCX. (${ocrMsg})`
      );
    }
  }

  throw new Error(`Unsupported file type: ${fileType}`);
}
