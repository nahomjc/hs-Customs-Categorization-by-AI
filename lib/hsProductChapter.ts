/** Product-type signals and HS chapter compatibility for reference / document HS gates. */

export type ProductSignals = {
  lighting: boolean;
  artificialPlant: boolean;
  wallpaper: boolean;
  fan: boolean;
  ceramic: boolean;
  food: boolean;
  /** Finished clothing / worn apparel (chs 61–62), not yarn/fabric. */
  apparel: boolean;
  /** Soft furnishings / made-up textiles (often ch 63), not fabric rolls. */
  textile: boolean;
  pump: boolean;
  insulation: boolean;
  /** Explicit fabric/yarn/material wording (chs 50–60). */
  textileMaterial: boolean;
};

/**
 * Finished garments / worn clothing — must not map to chapter 50–60 fabric rows
 * just because words like "cotton" or "denim" overlap.
 */
const APPAREL_RE =
  /\b(?:t-?shirts?|tee\s*shirts?|shirts?|polo\s*shirts?|blouses?|tops?\b|jeans?\b|trousers?|pants?\b|slacks?|breeches|shorts?|skirts?|dresses?|suits?\b|jackets?|blazers?|coats?\b|hoodies?|sweatshirts?|jumpers?|cardigans?|sweaters?|pullovers?|vests?\b|waistcoats?|overalls?|coveralls?|leggings?|hosiery|socks?|stockings?|gloves?\b|mittens?|scarves?|shawls?|ties?\b|cravats?|underwear|briefs?|panties|bras?\b|lingerie|swimwear|swimsuits?|bikinis?|garments?|apparel|clothing|wear\b|uniforms?)\b/i;

/** Soft home textiles / made-ups — prefer 63 (and sometimes 61/62), not fabric. */
const TEXTILE_MADEUP_RE =
  /towel|bed\s*linen|bed\s*sheet|pillow\s*case|duvet|blanket|quilt|curtain|table\s*linen|napkin|made[\s-]?up\s+textile/i;

/** Yarn / woven / knitted fabric as the product itself. */
const TEXTILE_MATERIAL_RE =
  /\b(?:fabric|cloth|textile\s*material|woven\s+fabric|knitted\s+fabric|yarn|thread|weave\b|denim\s+fabric|cotton\s+fabric|unbleached\s+cotton|grey\s+fabric|greige)\b/i;

export function detectProductSignals(description: string): ProductSignals {
  const d = description.toLowerCase();
  const looksLikeMaterial = TEXTILE_MATERIAL_RE.test(d);
  // "denim fabric for garments" is material; "denim jeans" is apparel.
  const apparel = APPAREL_RE.test(d) && !looksLikeMaterial;
  const textileMaterial = looksLikeMaterial && !apparel;

  return {
    lighting:
      /led|lamp|lights?|pendant|track\s*light|spotlight|chandelier|magnetic\s*track|luminaire|lighting|pendent\s*light|wall\s*light/i.test(
        d,
      ),
    artificialPlant:
      /artificial\s+(plant|flower|tree)|taro\s+plant|ficus|artificial\s+ficus|artificial\s+plant/i.test(
        d,
      ),
    wallpaper: /wallpaper|wall\s*covering|wall\s*paper/i.test(d),
    fan:
      /\bfan\b|extract\s*fan|air\s*supply\s*fan|bathroom\s*extract/i.test(d) &&
      !/ceiling\s*fan\s*motor/i.test(d),
    ceramic: /ceramic|pottery|vase\b/i.test(d),
    food: /sausage|sauce|vinegar|soup|snack|noodle|pasta|rice\b|cereal|sugar|meat|tea\b|oil\b|bean|tomato|mandarin|orange|citrus|poultry|palm|soy/i.test(
      d,
    ),
    apparel,
    textile: TEXTILE_MADEUP_RE.test(d),
    pump: /fountain\b|water\s*feature/i.test(d),
    insulation:
      /fib(?:er|re)glass|glass\s*wool|heat\s*insulation|thermal\s*insulation/i.test(
        d,
      ),
    textileMaterial,
  };
}

/** Chapters that fit this description when signals are present (null = no strong signal). */
export function expectedChapters(description: string): string[] | null {
  const s = detectProductSignals(description);
  // Apparel first — never allow fabric chapters 50–60 for finished clothes.
  if (s.apparel) return ["61", "62"];
  if (s.lighting) return ["94", "85"];
  if (s.artificialPlant) return ["67"];
  if (s.wallpaper) return ["48"];
  if (s.fan) return ["84", "85"];
  if (s.ceramic) return ["69"];
  if (s.food) return ["02", "07", "08", "09", "11", "12", "15", "16", "17", "19", "20", "21", "22"];
  if (s.textile) return ["63", "61", "62"];
  if (s.textileMaterial) return ["50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60"];
  if (s.pump) return ["84"];
  if (s.insulation) return ["70"];
  return null;
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
