/**
 * Real context for one product, built from the data already in the case, and
 * the reviewer's note for the AI. Everything is capped so the prompt stays
 * bounded. Empty fields are left out; nothing is invented.
 *
 * Pure module (no database): `product-context-load.ts` does the loading.
 */

import { extractSupplierHsCode } from "../hs-plausibility";

type Scalar = string | number | null | undefined;

export type ContextProduct = {
  rawDescription?: string | null;
  normalizedDescription?: string | null;
  productName?: string | null;
  brand?: string | null;
  modelNumber?: string | null;
  manufacturer?: string | null;
  material?: string | null;
  intendedUse?: string | null;
  productType?: string | null;
  technicalSpecifications?: unknown;
  quantity?: Scalar;
  unitOfMeasure?: string | null;
  unitPrice?: Scalar;
  lineTotalAmount?: Scalar;
  currencyCode?: string | null;
  countryOfOriginCode?: string | null;
  netWeightKg?: Scalar;
  grossWeightKg?: Scalar;
  packageType?: string | null;
  numberOfPackages?: Scalar;
};

export type ContextInvoiceLine = {
  supplierDescription?: string | null;
  supplierSku?: string | null;
  brand?: string | null;
  modelNumber?: string | null;
  quantity?: Scalar;
  unitOfMeasure?: string | null;
  unitPrice?: Scalar;
  lineTotalAmount?: Scalar;
  currencyCode?: string | null;
  countryOfOriginCode?: string | null;
  extra?: Record<string, string> | null;
};

export type ContextPackingLine = {
  supplierDescription?: string | null;
  supplierSku?: string | null;
  brand?: string | null;
  modelNumber?: string | null;
  quantity?: Scalar;
  unitOfMeasure?: string | null;
  packageType?: string | null;
  numberOfPackages?: Scalar;
  piecesPerPackage?: Scalar;
  netWeightKg?: Scalar;
  grossWeightKg?: Scalar;
  lengthCm?: Scalar;
  widthCm?: Scalar;
  heightCm?: Scalar;
  packageMarks?: string | null;
  extra?: Record<string, string> | null;
};

export type ContextCase = {
  importerName?: string | null;
  supplierName?: string | null;
  supplierCountryCode?: string | null;
  countryOfExportCode?: string | null;
  countryOfOriginCode?: string | null;
  incoterm?: string | null;
  invoiceCurrencyCode?: string | null;
};

/** Size limits that keep the prompt bounded. */
export const CONTEXT_LIMITS = {
  totalChars: 3500,
  lines: 3,
  extraEntries: 8,
  extraValueChars: 80,
  descriptionChars: 300,
  otherProducts: 20,
  otherProductChars: 70,
  specEntries: 8,
  noteChars: 500,
} as const;

export type NameHints = {
  brand?: string;
  /** Chinese (CJK) text found in the product data. */
  cjkNames: string[];
  /** Values of columns that look like a pinyin / Chinese-name column. */
  pinyinNames: string[];
  supplier?: string;
  origin?: string;
  productType?: string;
  /** The supplier's own HS code from the invoice / packing columns (digits). A hint only. */
  supplierHsCode?: string;
};

export type ProductContext = {
  /** Bounded text block for the prompts ("" when there is nothing to add). */
  text: string;
  hints: NameHints;
  /** Reviewer note (highest priority), already trimmed and capped. */
  userNote?: string;
};

function clip(value: unknown, max: number): string {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}...` : s;
}

function num(value: Scalar): string {
  if (value == null || value === "") return "";
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) return clip(value, 20);
  return String(Number.parseFloat(n.toFixed(4)));
}

function pairs(items: Array<[string, string | undefined | null]>): string {
  return items
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
}

function extraText(extra: Record<string, string> | null | undefined): string {
  if (!extra || typeof extra !== "object") return "";
  const entries = Object.entries(extra)
    .filter(([k, v]) => k.trim() && typeof v === "string" && v.trim())
    .slice(0, CONTEXT_LIMITS.extraEntries)
    .map(
      ([k, v]) =>
        `${clip(k, 40)}=${clip(v, CONTEXT_LIMITS.extraValueChars)}`,
    );
  return entries.join(", ");
}

const CJK_RE = /[\u3400-\u9fff]+/g;
const PINYIN_KEY_RE = /pinyin|chinese|china name|cn name|local name|\u4e2d\u6587|\u62fc\u97f3|\u54c1\u540d/i;

export function extractNameHints(
  product: ContextProduct,
  invoiceLines: ContextInvoiceLine[] = [],
  packingLines: ContextPackingLine[] = [],
  caseInfo: ContextCase | null = null,
): NameHints {
  const texts: string[] = [
    product.rawDescription ?? "",
    product.normalizedDescription ?? "",
    product.productName ?? "",
    ...invoiceLines.map((l) => l.supplierDescription ?? ""),
    ...packingLines.map((l) => `${l.supplierDescription ?? ""} ${l.packageMarks ?? ""}`),
  ];
  const extras = [
    ...invoiceLines.map((l) => l.extra),
    ...packingLines.map((l) => l.extra),
  ].filter((e): e is Record<string, string> => !!e && typeof e === "object");
  for (const e of extras) texts.push(...Object.values(e).filter((v) => typeof v === "string"));

  const cjk = new Set<string>();
  for (const t of texts) {
    for (const m of t.match(CJK_RE) ?? []) {
      cjk.add(m.slice(0, 20));
      if (cjk.size >= 3) break;
    }
  }

  const pinyin = new Set<string>();
  for (const e of extras) {
    for (const [k, v] of Object.entries(e)) {
      if (PINYIN_KEY_RE.test(k) && typeof v === "string" && v.trim()) {
        pinyin.add(clip(v, 40));
        if (pinyin.size >= 3) break;
      }
    }
  }

  const brand =
    product.brand?.trim() ||
    invoiceLines.find((l) => l.brand?.trim())?.brand?.trim() ||
    packingLines.find((l) => l.brand?.trim())?.brand?.trim() ||
    undefined;

  return {
    brand: brand ? clip(brand, 60) : undefined,
    cjkNames: [...cjk],
    pinyinNames: [...pinyin],
    supplier: caseInfo?.supplierName?.trim() ? clip(caseInfo.supplierName, 80) : undefined,
    origin:
      (product.countryOfOriginCode ||
        caseInfo?.countryOfOriginCode ||
        caseInfo?.supplierCountryCode ||
        "")
        .trim() || undefined,
    productType: product.productType?.trim() ? clip(product.productType, 60) : undefined,
    supplierHsCode: extractSupplierHsCode(extras) ?? undefined,
  };
}

/** Keep only a safe, short note: trims, collapses blank runs, caps the length. */
export function sanitizeNote(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, CONTEXT_LIMITS.noteChars);
}

type ReviewerNoteRecord = { text: string; byUserId?: string; at?: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** The saved reviewer note of a product ("" when none). */
export function getReviewerNote(technicalSpecifications: unknown): string {
  if (!isRecord(technicalSpecifications)) return "";
  const note = technicalSpecifications.reviewerNote;
  if (isRecord(note) && typeof note.text === "string") return sanitizeNote(note.text);
  return "";
}

/**
 * Returns the specifications JSON with the reviewer note set (or removed when
 * the note is empty). Existing specification data is kept.
 */
export function withReviewerNote(
  technicalSpecifications: unknown,
  note: string,
  meta: { byUserId?: string; at?: string } = {},
): Record<string, unknown> {
  let base: Record<string, unknown>;
  if (isRecord(technicalSpecifications)) {
    base = { ...technicalSpecifications };
  } else if (technicalSpecifications == null) {
    base = {};
  } else {
    base = { normalizedSpecifications: technicalSpecifications };
  }
  const clean = sanitizeNote(note);
  if (!clean) {
    delete base.reviewerNote;
    return base;
  }
  const record: ReviewerNoteRecord = { text: clean, ...meta };
  base.reviewerNote = record;
  return base;
}

export type BuildContextInput = {
  product: ContextProduct;
  invoiceLines?: ContextInvoiceLine[];
  packingLines?: ContextPackingLine[];
  caseInfo?: ContextCase | null;
  /** Descriptions of the other products in the same case. */
  otherProducts?: string[];
};

export function buildProductContext(input: BuildContextInput): ProductContext {
  const { product } = input;
  const invoiceLines = (input.invoiceLines ?? []).slice(0, CONTEXT_LIMITS.lines);
  const packingLines = (input.packingLines ?? []).slice(0, CONTEXT_LIMITS.lines);
  const caseInfo = input.caseInfo ?? null;
  const hints = extractNameHints(product, invoiceLines, packingLines, caseInfo);
  const userNote = getReviewerNote(product.technicalSpecifications) || undefined;

  const sections: string[] = [];

  // 1. the product record
  const specs = isRecord(product.technicalSpecifications)
    ? Object.entries(product.technicalSpecifications)
        .filter(
          ([k, v]) =>
            k !== "reviewerNote" &&
            (typeof v === "string" || typeof v === "number") &&
            String(v).trim(),
        )
        .slice(0, CONTEXT_LIMITS.specEntries)
        .map(([k, v]) => `${clip(k, 30)}=${clip(v, 60)}`)
        .join(", ")
    : "";
  const record = [
    pairs([
      ["Name", product.productName ? clip(product.productName, 120) : ""],
      [
        "Description",
        clip(
          product.normalizedDescription || product.rawDescription,
          CONTEXT_LIMITS.descriptionChars,
        ),
      ],
      [
        "Original wording",
        product.rawDescription &&
        product.rawDescription !== product.normalizedDescription
          ? clip(product.rawDescription, CONTEXT_LIMITS.descriptionChars)
          : "",
      ],
    ]),
    pairs([
      ["Brand", product.brand ? clip(product.brand, 60) : ""],
      ["Model", product.modelNumber ? clip(product.modelNumber, 60) : ""],
      ["Manufacturer", product.manufacturer ? clip(product.manufacturer, 80) : ""],
      ["Type", product.productType ? clip(product.productType, 60) : ""],
      ["Material", product.material ? clip(product.material, 80) : ""],
      ["Intended use", product.intendedUse ? clip(product.intendedUse, 120) : ""],
      ["Specifications", specs],
    ]),
    pairs([
      ["Quantity", [num(product.quantity), product.unitOfMeasure ?? ""].join(" ").trim()],
      ["Unit price", [num(product.unitPrice), product.currencyCode ?? ""].join(" ").trim()],
      ["Amount", [num(product.lineTotalAmount), product.currencyCode ?? ""].join(" ").trim()],
      ["Origin", product.countryOfOriginCode ?? ""],
      [
        "Packaging",
        [
          product.packageType ?? "",
          product.numberOfPackages != null ? `x ${num(product.numberOfPackages)}` : "",
        ]
          .join(" ")
          .trim(),
      ],
      ["Net kg", num(product.netWeightKg)],
      ["Gross kg", num(product.grossWeightKg)],
    ]),
  ]
    .filter(Boolean)
    .map((l) => `- ${l}`)
    .join("\n");
  if (record) sections.push(`Product record:\n${record}`);

  // 1b. the supplier's own HS code: a hint, not the truth
  if (hints.supplierHsCode) {
    const d = hints.supplierHsCode;
    const shown = d.length >= 8 ? `${d.slice(0, 4)}.${d.slice(4, 8)}` : d;
    sections.push(
      `Supplier's HS code from the invoice (a HINT only: the supplier may be wrong; use it to pick the right chapter, never copy it blindly):\n- ${shown}`,
    );
  }

  // 2. importer / case
  if (caseInfo) {
    const c = pairs([
      ["Importer", caseInfo.importerName ? clip(caseInfo.importerName, 80) : ""],
      [
        "Supplier",
        [
          caseInfo.supplierName ? clip(caseInfo.supplierName, 80) : "",
          caseInfo.supplierCountryCode ? `(${caseInfo.supplierCountryCode})` : "",
        ]
          .join(" ")
          .trim(),
      ],
      ["Country of export", caseInfo.countryOfExportCode ?? ""],
      ["Country of origin", caseInfo.countryOfOriginCode ?? ""],
      ["Incoterm", caseInfo.incoterm ?? ""],
      ["Currency", caseInfo.invoiceCurrencyCode ?? ""],
    ]);
    if (c) sections.push(`Case:\n- ${c}`);
  }

  // 3. invoice lines (supplier wording, prices, extra columns)
  const inv = invoiceLines
    .map((l, i) => {
      const body = pairs([
        ["wording", l.supplierDescription ? `"${clip(l.supplierDescription, CONTEXT_LIMITS.descriptionChars)}"` : ""],
        ["sku", l.supplierSku ? clip(l.supplierSku, 40) : ""],
        ["brand", l.brand ? clip(l.brand, 40) : ""],
        ["model", l.modelNumber ? clip(l.modelNumber, 40) : ""],
        ["qty", [num(l.quantity), l.unitOfMeasure ?? ""].join(" ").trim()],
        ["unit price", [num(l.unitPrice), l.currencyCode ?? ""].join(" ").trim()],
        ["amount", [num(l.lineTotalAmount), l.currencyCode ?? ""].join(" ").trim()],
        ["origin", l.countryOfOriginCode ?? ""],
        ["extra columns", extraText(l.extra)],
      ]);
      return body ? `${i + 1}. ${body}` : "";
    })
    .filter(Boolean);
  if (inv.length) sections.push(`Invoice lines:\n${inv.join("\n")}`);

  // 4. packing lines
  const pack = packingLines
    .map((l, i) => {
      const dims = [num(l.lengthCm), num(l.widthCm), num(l.heightCm)];
      const body = pairs([
        ["wording", l.supplierDescription ? `"${clip(l.supplierDescription, CONTEXT_LIMITS.descriptionChars)}"` : ""],
        ["sku", l.supplierSku ? clip(l.supplierSku, 40) : ""],
        ["qty", [num(l.quantity), l.unitOfMeasure ?? ""].join(" ").trim()],
        ["package", [l.packageType ?? "", l.numberOfPackages != null ? `x ${num(l.numberOfPackages)}` : ""].join(" ").trim()],
        ["pieces per package", num(l.piecesPerPackage)],
        ["net kg", num(l.netWeightKg)],
        ["gross kg", num(l.grossWeightKg)],
        ["size cm", dims.every(Boolean) ? dims.join("x") : ""],
        ["marks", l.packageMarks ? clip(l.packageMarks, 60) : ""],
        ["extra columns", extraText(l.extra)],
      ]);
      return body ? `${i + 1}. ${body}` : "";
    })
    .filter(Boolean);
  if (pack.length) sections.push(`Packing lines:\n${pack.join("\n")}`);

  // 5. other products (lowest priority)
  const own = new Set(
    [product.normalizedDescription, product.rawDescription, product.productName]
      .filter(Boolean)
      .map((s) => String(s).trim().toLowerCase()),
  );
  const others = [...new Set((input.otherProducts ?? []).map((p) => clip(p, CONTEXT_LIMITS.otherProductChars)).filter(Boolean))]
    .filter((p) => !own.has(p.toLowerCase()))
    .slice(0, CONTEXT_LIMITS.otherProducts);
  if (others.length) {
    sections.push(
      `Other products in the same shipment (the kind of goods this importer brings in):\n- ${others.join("\n- ")}`,
    );
  }

  // keep whole sections in priority order; truncate the last one that fits
  let text = "";
  for (const section of sections) {
    const next = text ? `${text}\n\n${section}` : section;
    if (next.length <= CONTEXT_LIMITS.totalChars) {
      text = next;
      continue;
    }
    const room = CONTEXT_LIMITS.totalChars - text.length - 2;
    if (room > 120) {
      text = `${text}${text ? "\n\n" : ""}${section.slice(0, room - 3)}...`;
    }
    break;
  }

  return { text, hints, userNote };
}

/**
 * Prompt block with the extra context. The reviewer's note is placed first and
 * marked as the highest-priority fact about the product.
 */
export function buildContextPromptBlock(options: {
  contextText?: string | null;
  userNote?: string | null;
  assumeImportItem?: boolean;
}): string {
  const parts: string[] = [];
  const note = sanitizeNote(options.userNote);
  if (note) {
    parts.push(
      `Reviewer note (HIGHEST PRIORITY, written by a person who has seen the goods; treat it as a fact about the product and follow it over guesses from the name):\n${note}`,
    );
  }
  if (options.assumeImportItem) {
    parts.push(
      "A person already confirmed this line is a real product to be imported. Do NOT answer that it is not an import item. If the name is unclear, say what you are unsure about instead.",
    );
  }
  const ctx = (options.contextText ?? "").trim();
  if (ctx) {
    parts.push(`Context from the shipment documents (real data, may be incomplete):\n${ctx.slice(0, CONTEXT_LIMITS.totalChars)}`);
  }
  return parts.join("\n\n");
}