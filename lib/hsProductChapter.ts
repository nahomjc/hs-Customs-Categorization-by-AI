/** Product-type signals and HS chapter compatibility for reference / document HS gates. */

export type ProductSignals = {
  lighting: boolean;
  artificialPlant: boolean;
  wallpaper: boolean;
  fan: boolean;
  ceramic: boolean;
  food: boolean;
  /** Finished clothing / worn apparel (chs 61-62), not yarn/fabric. */
  apparel: boolean;
  /** Soft furnishings / made-up textiles (often ch 63), not fabric rolls. */
  textile: boolean;
  pump: boolean;
  insulation: boolean;
  /** Explicit fabric/yarn/material wording (chs 50-60). */
  textileMaterial: boolean;
  /** Cookware, tableware, tea sets, utensils (metal / ceramic / plastic articles). */
  kitchenware: boolean;
  /** Incense, perfume, fragrance, candles. */
  incense: boolean;
};

/**
 * Finished garments / worn clothing: must not map to chapter 50-60 fabric rows
 * just because words like "cotton" or "denim" overlap.
 */
const APPAREL_RE =
  /\b(?:t-?shirts?|tee\s*shirts?|shirts?|polo\s*shirts?|blouses?|tops?\b|jeans?\b|trousers?|pants?\b|slacks?|breeches|shorts?|skirts?|dresses?|suits?\b|jackets?|blazers?|coats?\b|hoodies?|sweatshirts?|jumpers?|cardigans?|sweaters?|pullovers?|vests?\b|waistcoats?|overalls?|coveralls?|leggings?|hosiery|socks?|stockings?|gloves?\b|mittens?|scarves?|shawls?|ties?\b|cravats?|underwear|briefs?|panties|bras?\b|lingerie|swimwear|swimsuits?|bikinis?|garments?|apparel|clothing|wear\b|uniforms?)\b/i;

/** Soft home textiles / made-ups: prefer 63 (and sometimes 61/62), not fabric. */
const TEXTILE_MADEUP_RE =
  /towel|bed\s*linen|bed\s*sheet|pillow\s*case|duvet|blanket|quilt|curtain|table\s*linen|napkin|made[\s-]?up\s+textile/i;

/** Yarn / woven / knitted fabric as the product itself. */
const TEXTILE_MATERIAL_RE =
  /\b(?:fabric|cloth|textile\s*material|woven\s+fabric|knitted\s+fabric|yarn|thread|weave\b|denim\s+fabric|cotton\s+fabric|unbleached\s+cotton|grey\s+fabric|greige)\b/i;

/** Words that clearly mean a light fitting (a bare "light" or "led" is weaker, see below). */
const LIGHTING_STRONG_RE =
  /\b(?:lamps?|bulbs?|luminaires?|chandeliers?|spotlights?|pendant|pendent|track\s*lights?|magnetic\s*track|wall\s*lights?|lighting|ceiling\s*lights?|floodlights?|downlights?)\b/i;

/** "light" / "led" alone: only counts when the text has no food words ("Light Soy Sauce"). */
const LIGHTING_WEAK_RE = /\b(?:led|lights?)\b/i;

/**
 * Whole-word food / drink / ingredient words. Word boundaries matter: "led" is
 * inside "milled", "tea" inside "stearin", "rice" inside "price".
 */
const FOOD_RE = new RegExp(
  "\\b(?:" +
    [
      "rice", "flours?", "cheese", "seasonings?", "msg", "monosodium", "anise", "cumin", "fennel",
      "pepper(?:corns?)?", "chil+(?:i|ies|is)?", "spices?", "curry", "ginger", "garlic", "onions?",
      "kelp", "seaweed", "laver", "nori", "juices?", "drinks?", "beverages?", "sodas?", "teas?",
      "coffee", "cocoa", "chocolates?", "candy", "candies", "sweets?", "biscuits?", "cookies?",
      "crackers?", "snacks?", "noodles?", "pasta", "vermicelli", "sauces?", "soy", "soya", "soybeans?",
      "vinegar", "ketchup", "mayonnaise", "sugar", "honey", "salt", "peanuts?", "cashews?", "almonds?",
      "walnuts?", "pistachios?", "hazelnuts?", "nuts?", "seeds?", "coconuts?", "beans?", "lentils?",
      "peas?", "corn", "maize", "wheat", "oats?", "barley", "millet", "sorghum", "starch", "tofu",
      "eggs?", "milk", "yogh?urt", "butter", "meat", "beef", "pork", "chicken", "duck", "lamb",
      "mutton", "fish", "shrimps?", "prawns?", "squid", "crab", "sausages?", "ham", "bacon", "fruits?",
      "apples?", "oranges?", "mandarins?", "citrus", "bananas?", "mango(?:es|s)?", "grapes?", "jam",
      "pickled?", "kimchi", "mushrooms?", "vegetables?", "tomato(?:es)?", "potato(?:es)?", "cabbage",
      "carrots?", "soups?", "bouillon", "broth", "dumplings?", "bread", "cakes?", "wine", "beer",
      "liquor", "baijiu", "vodka", "whisk(?:e)?y", "sesame", "cinnamon", "turmeric", "paprika",
      "mustard", "yeast", "gelatin", "pectin", "tapioca", "cassava", "konjac", "jujubes?", "lychee",
      "longan", "tamarind", "wasabi", "miso", "sake", "kombucha", "sweeteners?", "flavou?rings?",
      "(?:cooking|edible|vegetable|frying)\\s+oil",
    ].join("|") +
    ")\\b",
  "i",
);

const KITCHENWARE_RE =
  /\b(?:steamers?|woks?|cookware|pots?|pans?|kettles?|tableware|kitchenware|chopsticks?|spoons?|forks?|knife|knives|utensils?|thermos|flasks?|lunch\s*box(?:es)?|mugs?|tea\s*(?:sets?|pots?|cups?|ware|trays?)|coffee\s*(?:pots?|makers?|cups?))\b/i;

const INCENSE_RE =
  /\b(?:incense|joss|perfumes?|cologne|fragrances?|air\s*fresheners?|candles?|aroma(?:therapy)?)\b/i;

export function detectProductSignals(description: string): ProductSignals {
  const d = description.toLowerCase();
  const looksLikeMaterial = TEXTILE_MATERIAL_RE.test(d);
  // "denim fabric for garments" is material; "denim jeans" is apparel.
  const apparel = APPAREL_RE.test(d) && !looksLikeMaterial;
  const textileMaterial = looksLikeMaterial && !apparel;
  const food = FOOD_RE.test(d);

  return {
    lighting: LIGHTING_STRONG_RE.test(d) || (LIGHTING_WEAK_RE.test(d) && !food),
    artificialPlant:
      /artificial\s+(plant|flower|tree)|taro\s+plant|ficus|artificial\s+ficus|artificial\s+plant/i.test(
        d,
      ),
    wallpaper: /wallpaper|wall\s*covering|wall\s*paper/i.test(d),
    fan:
      /\bfan\b|extract\s*fan|air\s*supply\s*fan|bathroom\s*extract/i.test(d) &&
      !/ceiling\s*fan\s*motor/i.test(d),
    ceramic: /ceramic|pottery|vase\b/i.test(d),
    food,
    apparel,
    textile: TEXTILE_MADEUP_RE.test(d),
    pump: /fountain\b|water\s*feature/i.test(d),
    insulation:
      /fib(?:er|re)glass|glass\s*wool|heat\s*insulation|thermal\s*insulation/i.test(
        d,
      ),
    textileMaterial,
    kitchenware: KITCHENWARE_RE.test(d),
    incense: INCENSE_RE.test(d),
  };
}

/** Chapters a food / drink / ingredient may legitimately sit in (incl. additives, flavours, starches). */
export const FOOD_ALLOWED_CHAPTERS = [
  "02", "03", "04", "07", "08", "09", "10", "11", "12", "13", "15", "16", "17", "18", "19",
  "20", "21", "22", "23", "24", "29", "33", "35", "38",
];

const KITCHENWARE_CHAPTERS = [
  "39", "40", "44", "48", "69", "70", "73", "74", "76", "82", "83", "84", "85", "96",
];

export type ProductFamily = {
  id: string;
  /** Plain-language name used in messages. */
  label: string;
  /** Chapters that fit this kind of product. */
  allowed: string[];
};

/** The kind of product the description clearly names, or null when it names none. */
export function productFamily(description: string): ProductFamily | null {
  const s = detectProductSignals(description);
  // Apparel first: never allow fabric chapters 50-60 for finished clothes.
  if (s.apparel) return { id: "apparel", label: "clothing", allowed: ["61", "62"] };
  if (s.lighting) return { id: "lighting", label: "lighting", allowed: ["94", "85"] };
  if (s.artificialPlant) return { id: "artificialPlant", label: "artificial plants", allowed: ["67"] };
  if (s.wallpaper) return { id: "wallpaper", label: "wallpaper", allowed: ["48"] };
  if (s.fan) return { id: "fan", label: "fans", allowed: ["84", "85"] };
  if (s.ceramic) return { id: "ceramic", label: "ceramic goods", allowed: ["69"] };
  if (s.kitchenware) return { id: "kitchenware", label: "kitchenware", allowed: KITCHENWARE_CHAPTERS };
  if (s.incense) return { id: "incense", label: "incense / fragrance", allowed: ["33", "34", "38", "14"] };
  if (s.food) return { id: "food", label: "food and drink", allowed: FOOD_ALLOWED_CHAPTERS };
  if (s.textile) return { id: "textile", label: "made-up textiles", allowed: ["63", "61", "62"] };
  if (s.textileMaterial) {
    return {
      id: "textileMaterial",
      label: "fabric and yarn",
      allowed: ["50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60"],
    };
  }
  if (s.pump) return { id: "pump", label: "pumps", allowed: ["84"] };
  if (s.insulation) return { id: "insulation", label: "insulation", allowed: ["70"] };
  return null;
}

/** Chapters that fit this description when signals are present (null = no strong signal). */
export function expectedChapters(description: string): string[] | null {
  return productFamily(description)?.allowed ?? null;
}

/**
 * Narrower chapters a food word points to (a ranking hint, never a filter):
 * "rice" is chapter 10 / 11, "tea" is 09, "sauce" is 21 and so on.
 */
const FOOD_PREFERENCES: Array<[RegExp, string[]]> = [
  [/\b(?:rice|wheat|corn|maize|oats?|barley|millet|sorghum)\b/i, ["10", "11", "19"]],
  [/\bflours?\b|\bstarch\b/i, ["11", "19", "35"]],
  [/\b(?:teas?|coffee|cumin|fennel|anise|cinnamon|turmeric|paprika|spices?|pepper(?:corns?)?|ginger)\b/i, ["09"]],
  [/\b(?:sauces?|soy|soya|vinegar|ketchup|mayonnaise|seasonings?|msg|monosodium|soups?|bouillon|broth|curry)\b/i, ["21", "20", "29"]],
  [/\b(?:juices?|drinks?|beverages?|sodas?|kombucha)\b/i, ["20", "22", "21"]],
  [/\b(?:nuts?|peanuts?|cashews?|almonds?|walnuts?|pistachios?|hazelnuts?|coconuts?)\b/i, ["08", "12", "20"]],
  [/\b(?:kelp|seaweed|laver|nori)\b/i, ["12", "21", "20"]],
  [/\b(?:fish|shrimps?|prawns?|squid|crab)\b/i, ["03", "16"]],
  [/\b(?:meat|beef|pork|chicken|duck|lamb|mutton|sausages?|ham|bacon)\b/i, ["02", "16"]],
  [/\b(?:cheese|milk|yogh?urt|butter|eggs?)\b/i, ["04", "21", "19"]],
  [/\b(?:sugar|honey|candy|candies|sweets?)\b/i, ["17", "18", "21"]],
  [/\b(?:chocolates?|cocoa)\b/i, ["18", "19"]],
  [/\b(?:noodles?|pasta|vermicelli|biscuits?|cookies?|crackers?|bread|cakes?|snacks?)\b/i, ["19", "21"]],
  [/\b(?:wine|beer|liquor|baijiu|vodka|whisk(?:e)?y|sake)\b/i, ["22"]],
  [/\b(?:cooking|edible|vegetable|frying)\s+oil\b|\b(?:sesame|peanut|olive|sunflower)\s+oil\b/i, ["15"]],
  [/\b(?:fruits?|apples?|oranges?|mandarins?|citrus|bananas?|mango(?:es|s)?|grapes?|jujubes?|lychee|longan)\b/i, ["08", "20"]],
  [/\b(?:vegetables?|tomato(?:es)?|potato(?:es)?|cabbage|carrots?|mushrooms?|kimchi|pickled?|garlic|onions?)\b/i, ["07", "20"]],
];

/** Chapters the product words point to, best first (empty when nothing specific). */
export function preferredChapters(description: string): string[] {
  const fam = productFamily(description);
  if (fam?.id !== "food") return [];
  const out: string[] = [];
  for (const [re, chapters] of FOOD_PREFERENCES) {
    if (!re.test(description)) continue;
    for (const c of chapters) if (!out.includes(c)) out.push(c);
  }
  return out;
}

export function isChapterCompatible(
  description: string,
  chapter: string | null | undefined,
): boolean {
  if (!chapter?.trim()) return true;

  const ch = chapter.padStart(2, "0").slice(0, 2);
  const expected = expectedChapters(description);
  if (!expected) return true;

  return expected.includes(ch);
}

export function chapterCompatibilityReasons(
  description: string,
  chapter: string | null | undefined,
): string[] {
  if (!chapter?.trim()) return [];
  if (isChapterCompatible(description, chapter)) return [];

  const expected = expectedChapters(description);
  const ch = chapter.padStart(2, "0").slice(0, 2);
  if (expected) {
    return [
      `Description suggests chapter ${expected.join("/")}, reference/document has ${ch}`,
    ];
  }
  return [];
}