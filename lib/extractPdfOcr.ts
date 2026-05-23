const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type FileAnnotation = {
  type: "file";
  file: {
    hash: string;
    name?: string;
    content: ContentPart[];
  };
};

function textFromAnnotations(annotations: FileAnnotation[]): string {
  const parts: string[] = [];
  for (const ann of annotations) {
    if (ann.type !== "file") continue;
    for (const part of ann.file.content) {
      if (part.type === "text" && part.text.trim()) {
        parts.push(part.text.trim());
      }
    }
  }
  return parts.join("\n\n");
}

function extractAnnotations(response: unknown): FileAnnotation[] {
  if (typeof response !== "object" || response === null) return [];

  const root = response as {
    choices?: Array<{ message?: { annotations?: unknown[] } }>;
    error?: { metadata?: { file_annotations?: unknown[] } };
  };

  const fromMessage = root.choices?.[0]?.message?.annotations ?? [];
  const fromError = root.error?.metadata?.file_annotations ?? [];

  const seen = new Set<string>();
  const out: FileAnnotation[] = [];
  for (const a of [...fromMessage, ...fromError]) {
    if (
      typeof a === "object" &&
      a !== null &&
      (a as FileAnnotation).type === "file" &&
      typeof (a as FileAnnotation).file?.hash === "string" &&
      !seen.has((a as FileAnnotation).file.hash)
    ) {
      seen.add((a as FileAnnotation).file.hash);
      out.push(a as FileAnnotation);
    }
  }
  return out;
}

/** OCR fallback for scanned / image-only PDFs via OpenRouter (mistral-ocr). */
export async function extractPdfTextViaOpenRouter(
  buffer: Buffer
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Scanned PDFs need OCR via OpenRouter."
    );
  }

  const dataUrl = `data:application/pdf;base64,${buffer.toString("base64")}`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3099",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Parse this document.",
            },
            {
              type: "file",
              file: {
                filename: "document.pdf",
                file_data: dataUrl,
              },
            },
          ],
        },
      ],
      plugins: [
        {
          id: "file-parser",
          pdf: { engine: "mistral-ocr" },
        },
      ],
      max_tokens: 8,
      temperature: 0,
    }),
  });

  const data = (await res.json()) as unknown;
  const annotations = extractAnnotations(data);
  const text = textFromAnnotations(annotations);

  if (text) {
    console.log(
      "[HS extractText] PDF OCR OK | text length:",
      text.length,
      "| first 80 chars:",
      text.slice(0, 80)
    );
    return text;
  }

  if (!res.ok) {
    const errBody = data as { error?: { message?: string } };
    const msg = errBody?.error?.message ?? `status ${res.status}`;
    throw new Error(`PDF OCR failed: ${msg}`);
  }

  const choices = data as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const modelText = choices.choices?.[0]?.message?.content?.trim() ?? "";
  if (modelText) return modelText;

  throw new Error(
    "PDF OCR returned no text. The file may be unreadable or too large."
  );
}
