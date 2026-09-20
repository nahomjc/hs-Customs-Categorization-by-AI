import { db } from "@/db";
import { hsCodeReference } from "@/db/schema";
import {
  getHsReferenceCacheRows,
  isReferencePopulated,
  setHsReferenceCache,
  type HsReferenceCacheRow,
} from "@/lib/hsReferenceCache";
import type { ProductAttributes, TariffMatch } from "./schemas";

async function ensureReferenceCache(): Promise<void> {
  if (isReferencePopulated() && getHsReferenceCacheRows().length > 0) return;
  const rows = await db.select().from(hsCodeReference);
  setHsReferenceCache(rows);
}

const MAX_RAW_SCORE = 100; // 30+15+15+10+20+10

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

/** Whole-token match (avoids "led" matching inside "chilled"). */
function descHasToken(desc: string, token: string): boolean {
  const t = token.toLowerCase().trim();
  if (!t) return false;
  if (t.length <= 3) {
    const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(t)}(?:[^a-z0-9]|$)`, "i");
    return re.test(desc);
  }
  return desc.includes(t);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Extra tariff-book keywords for common product families. */
function synonymTokens(attributes: ProductAttributes): string[] {
  const bag = [
    attributes.productName,
    attributes.productType,
    attributes.function,
    attributes.useCase,
    attributes.otherAttributes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const extras: string[] = [];
  if (/led|bulb|lamp|lighting|light/.test(bag)) {
    extras.push(
      "lamp",
      "lamps",
      "lighting",
      "filament",
      "discharge",
      "led",
      "bulb",
      "ultraviolet",
      "electric",
    );
  }
  if (/motor/.test(bag)) {
    extras.push("motor", "motors", "electric", "output");
  }
  if (/t-?shirt|shirt|cotton|apparel|garment/.test(bag)) {
    extras.push("tshirts", "cotton", "knitted", "crocheted", "garments");
  }
  if (/plastic|container/.test(bag)) {
    extras.push("plastic", "articles", "tableware", "kitchenware", "containers");
  }
  if (/knife|cutlery/.test(bag)) {
    extras.push("knives", "cutlery", "kitchen", "stainless");
  }
  return extras;
}

function uniqueTokens(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const value of values) {
    if (!value?.trim()) continue;
    for (const t of tokenize(value)) set.add(t);
  }
  return [...set];
}

/**
 * Small chapter hints for common product families (decision-support only).
 */
export function impliedChapters(attributes: ProductAttributes): string[] {
  const bag = [
    attributes.productName,
    attributes.productType,
    attributes.function,
    attributes.useCase,
    attributes.material,
    attributes.otherAttributes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const chapters = new Set<string>();

  if (
    /led|bulb|lamp|lighting|luminaire|floodlight|tube light|light source/.test(
      bag,
    )
  ) {
    chapters.add("85");
    chapters.add("94");
  }
  if (/motor|electric motor|workshop/.test(bag)) {
    chapters.add("85");
  }
  if (
    /t-?shirt|shirt|cotton|apparel|garment|clothing|men'?s|women'?s/.test(bag)
  ) {
    chapters.add("61");
    chapters.add("62");
  }
  if (/plastic|container|lid|food container|box/.test(bag)) {
    chapters.add("39");
  }
  if (/knife|cutlery|kitchen knife|stainless/.test(bag)) {
    chapters.add("82");
  }

  return [...chapters];
}

function scoreRow(
  row: HsReferenceCacheRow,
  attributes: ProductAttributes,
): {
  rawTotal: number;
  productType: number;
  material: number;
  functionUse: number;
  power: number;
  keywordOverlap: number;
  chapter: number;
} {
  const desc = row.description.toLowerCase();
  const productTypeTokens = uniqueTokens([
    attributes.productType,
    attributes.productName,
  ]);
  const materialTokens = uniqueTokens([attributes.material]);
  const functionTokens = uniqueTokens([
    attributes.function,
    attributes.useCase,
  ]);
  const powerTokens: string[] = [];
  if (attributes.powerWatts != null) {
    powerTokens.push(String(attributes.powerWatts));
    powerTokens.push(`${attributes.powerWatts}w`);
    powerTokens.push("watt");
  }
  const allKeywords = uniqueTokens([
    attributes.productName,
    attributes.productType,
    attributes.material,
    attributes.function,
    attributes.useCase,
    attributes.brand,
    attributes.model,
    attributes.otherAttributes,
    attributes.condition,
    ...synonymTokens(attributes),
  ]);

  // Drop ultra-generic tokens that pollute overlap (e.g. "home", "new")
  const GENERIC = new Set([
    "home",
    "new",
    "used",
    "item",
    "product",
    "general",
    "other",
    "type",
    "food", // too broad — matches foodstuffs when querying plastic "food containers"
    "storage",
    "kitchen",
  ]);
  const filteredKeywords = allKeywords.filter((t) => !GENERIC.has(t));

  let productType = 0;
  for (const t of productTypeTokens) {
    if (descHasToken(desc, t)) {
      productType = 30;
      break;
    }
  }
  // Avoid botanical "bulb" matches when the query is clearly electric lighting
  const lightingQuery = impliedChapters(attributes).some(
    (c) => c === "85" || c === "94",
  );
  if (lightingQuery && productType > 0) {
    const botanical =
      /tuber|rhizome|corm|chicory|dormant|in growth|flower/.test(desc);
    if (botanical) productType = 0;
  }

  let material = 0;
  for (const t of materialTokens) {
    if (descHasToken(desc, t)) {
      material = 15;
      break;
    }
  }

  let functionUse = 0;
  for (const t of functionTokens) {
    if (GENERIC.has(t)) continue;
    if (descHasToken(desc, t)) {
      functionUse = 15;
      break;
    }
  }

  let power = 0;
  for (const t of powerTokens) {
    if (descHasToken(desc, t)) {
      power = 10;
      break;
    }
  }

  let overlapHits = 0;
  for (const t of filteredKeywords) {
    if (descHasToken(desc, t)) overlapHits += 1;
  }
  const keywordOverlap = Math.min(
    20,
    Math.round((overlapHits / Math.max(1, filteredKeywords.length)) * 20),
  );

  const chapters = impliedChapters(attributes);
  const rowChapter = (row.chapter ?? row.normalizedHs?.slice(0, 2) ?? "")
    .padStart(2, "0")
    .slice(0, 2);
  const chapter =
    chapters.length > 0 && rowChapter && chapters.includes(rowChapter) ? 10 : 0;

  const rawTotal =
    productType + material + functionUse + power + keywordOverlap + chapter;

  return {
    rawTotal,
    productType,
    material,
    functionUse,
    power,
    keywordOverlap,
    chapter,
  };
}

function displayHsCode(row: HsReferenceCacheRow): string {
  return (
    row.normalizedHs?.trim() ||
    row.hsCode?.trim() ||
    row.tariffNo.trim()
  );
}

/**
 * Deterministic tariff-book search over cached `hs_code_reference` rows.
 */
export async function searchTariffCodes(
  productAttributes: ProductAttributes,
  limit = 20,
): Promise<TariffMatch[]> {
  await ensureReferenceCache();
  const rows = getHsReferenceCacheRows();
  if (rows.length === 0) return [];

  const scoredAll = rows.map((row) => {
    const breakdown = scoreRow(row, productAttributes);
    return { row, breakdown };
  });

  const chapters = impliedChapters(productAttributes);
  const inChapter = (row: HsReferenceCacheRow) => {
    if (chapters.length === 0) return true;
    const rowChapter = (row.chapter ?? row.normalizedHs?.slice(0, 2) ?? "")
      .padStart(2, "0")
      .slice(0, 2);
    return Boolean(rowChapter && chapters.includes(rowChapter));
  };

  // When we know likely chapters (e.g. lighting → 85/94), search those first
  // so botanical "bulb" rows do not crowd out lamps.
  let pool = scoredAll;
  if (chapters.length > 0) {
    const chapterHits = scoredAll.filter(
      (s) =>
        inChapter(s.row) &&
        (s.breakdown.productType > 0 ||
          s.breakdown.material > 0 ||
          s.breakdown.functionUse > 0 ||
          s.breakdown.power > 0 ||
          s.breakdown.keywordOverlap >= 4),
    );
    if (chapterHits.length >= 1) {
      pool = chapterHits.map((s) => ({
        ...s,
        breakdown: {
          ...s.breakdown,
          rawTotal: s.breakdown.rawTotal + 25,
          chapter: s.breakdown.chapter + 25,
        },
      }));
    }
    // If the loaded tariff book lacks those chapters (common on partial imports),
    // fall through to global keyword scoring instead of returning empty.
  }

  const scored = pool
    .filter((s) => {
      if (s.breakdown.rawTotal <= 0) return false;
      return (
        s.breakdown.productType > 0 ||
        s.breakdown.material > 0 ||
        s.breakdown.functionUse > 0 ||
        s.breakdown.chapter > 0 ||
        s.breakdown.keywordOverlap >= 8
      );
    })
    .sort((a, b) => b.breakdown.rawTotal - a.breakdown.rawTotal)
    .slice(0, Math.max(1, Math.min(limit, 50)));

  return scored.map(({ row, breakdown }) => ({
    hsCode: displayHsCode(row),
    tariffNo: row.tariffNo,
    officialDescription: row.description,
    chapter: row.chapter,
    heading: row.heading,
    dutyRate: row.dutyRate,
    stdUnit: row.stdUnit,
    relevanceScore: Math.min(
      1,
      Math.round((breakdown.rawTotal / MAX_RAW_SCORE) * 10000) / 10000,
    ),
    scoreBreakdown: {
      productType: breakdown.productType,
      material: breakdown.material,
      functionUse: breakdown.functionUse,
      power: breakdown.power,
      keywordOverlap: breakdown.keywordOverlap,
      chapter: breakdown.chapter,
      rawTotal: breakdown.rawTotal,
    },
  }));
}
