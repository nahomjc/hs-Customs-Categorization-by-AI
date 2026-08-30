/** Product-type signals and HS chapter compatibility for reference / document HS gates. */

export type ProductSignals = {
  lighting: boolean;
  artificialPlant: boolean;
  wallpaper: boolean;
  fan: boolean;
  ceramic: boolean;
  food: boolean;
  textile: boolean;
  pump: boolean;
  insulation: boolean;
};

export function detectProductSignals(description: string): ProductSignals {
  const d = description.toLowerCase();
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
    textile: /towel|textile|briefs|underwear|bed\s*linen/i.test(d),
    pump: /fountain\b|water\s*feature/i.test(d),
    insulation:
      /fib(?:er|re)glass|glass\s*wool|heat\s*insulation|thermal\s*insulation/i.test(
        d,
      ),
  };
}

/** Chapters that fit this description when signals are present (null = no strong signal). */
export function expectedChapters(description: string): string[] | null {
  const s = detectProductSignals(description);
  if (s.lighting) return ["94", "85"];
  if (s.artificialPlant) return ["67"];
  if (s.wallpaper) return ["48"];
  if (s.fan) return ["84", "85"];
  if (s.ceramic) return ["69"];
  if (s.food) return ["02", "07", "08", "09", "11", "12", "15", "16", "17", "19", "20", "21", "22"];
  if (s.textile) return ["63", "61", "62"];
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
