/**
 * HS "book view" shared types and standard HS nomenclature (client-safe).
 * Section > Chapter > Heading (4-digit) > Subheading / tariff lines.
 */

export type HsBookChapter = {
  /** Two-digit chapter, e.g. "04". */
  chapter: string;
  title: string;
  /** Rows loaded in hs_code_reference for this chapter. */
  rowCount: number;
  hasNotes: boolean;
};

export type HsBookSection = {
  /** Roman numeral, e.g. "I". */
  number: string;
  title: string;
  chapters: HsBookChapter[];
};

export type HsBookSkeleton = {
  sections: HsBookSection[];
  chapterCount: number;
  /** True when hs_chapter_notes could not be read (standard titles used). */
  notesUnavailable: boolean;
};

export type HsBookLine = {
  id: string;
  heading: string | null;
  hsCode: string | null;
  normalizedHs: string | null;
  tariffNo: string;
  description: string;
  stdUnit: string | null;
  dutyRate: string | null;
  chapter: string | null;
  /** Indent level (0-4) derived from the leading dashes of the tariff text. */
  depth: number;
};

export type HsBookHeading = {
  /** Four digits, e.g. "0401". */
  key: string;
  /** Display code, e.g. "04.01". */
  code: string;
  /** Null when the data has no usable title. */
  title: string | null;
  /** True when the title is the first tariff line (no 4-digit row in the data). */
  titleDerived: boolean;
  lineCount: number;
  lines: HsBookLine[];
};

export type HsBookChapterData = {
  chapter: string;
  rowCount: number;
  headings: HsBookHeading[];
};

export const HS_STANDARD_SECTIONS: {
  number: string;
  title: string;
  from: number;
  to: number;
}[] = [
  { number: "I", title: "Live animals; animal products", from: 1, to: 5 },
  { number: "II", title: "Vegetable products", from: 6, to: 14 },
  {
    number: "III",
    title:
      "Animal, vegetable or microbial fats and oils and their cleavage products; prepared edible fats; animal or vegetable waxes",
    from: 15,
    to: 15,
  },
  {
    number: "IV",
    title:
      "Prepared foodstuffs; beverages, spirits and vinegar; tobacco and manufactured tobacco substitutes",
    from: 16,
    to: 24,
  },
  { number: "V", title: "Mineral products", from: 25, to: 27 },
  {
    number: "VI",
    title: "Products of the chemical or allied industries",
    from: 28,
    to: 38,
  },
  {
    number: "VII",
    title: "Plastics and articles thereof; rubber and articles thereof",
    from: 39,
    to: 40,
  },
  {
    number: "VIII",
    title:
      "Raw hides and skins, leather, furskins and articles thereof; saddlery and harness; travel goods, handbags and similar containers; articles of animal gut (other than silk-worm gut)",
    from: 41,
    to: 43,
  },
  {
    number: "IX",
    title:
      "Wood and articles of wood; wood charcoal; cork and articles of cork; manufactures of straw, of esparto or of other plaiting materials; basketware and wickerwork",
    from: 44,
    to: 46,
  },
  {
    number: "X",
    title:
      "Pulp of wood or of other fibrous cellulosic material; recovered (waste and scrap) paper or paperboard; paper and paperboard and articles thereof",
    from: 47,
    to: 49,
  },
  { number: "XI", title: "Textiles and textile articles", from: 50, to: 63 },
  {
    number: "XII",
    title:
      "Footwear, headgear, umbrellas, sun umbrellas, walking sticks, seat-sticks, whips, riding-crops and parts thereof; prepared feathers and articles made therewith; artificial flowers; articles of human hair",
    from: 64,
    to: 67,
  },
  {
    number: "XIII",
    title:
      "Articles of stone, plaster, cement, asbestos, mica or similar materials; ceramic products; glass and glassware",
    from: 68,
    to: 70,
  },
  {
    number: "XIV",
    title:
      "Natural or cultured pearls, precious or semi-precious stones, precious metals, metals clad with precious metal, and articles thereof; imitation jewellery; coin",
    from: 71,
    to: 71,
  },
  {
    number: "XV",
    title: "Base metals and articles of base metal",
    from: 72,
    to: 83,
  },
  {
    number: "XVI",
    title:
      "Machinery and mechanical appliances; electrical equipment; parts thereof; sound recorders and reproducers, television image and sound recorders and reproducers, and parts and accessories of such articles",
    from: 84,
    to: 85,
  },
  {
    number: "XVII",
    title: "Vehicles, aircraft, vessels and associated transport equipment",
    from: 86,
    to: 89,
  },
  {
    number: "XVIII",
    title:
      "Optical, photographic, cinematographic, measuring, checking, precision, medical or surgical instruments and apparatus; clocks and watches; musical instruments; parts and accessories thereof",
    from: 90,
    to: 92,
  },
  {
    number: "XIX",
    title: "Arms and ammunition; parts and accessories thereof",
    from: 93,
    to: 93,
  },
  { number: "XX", title: "Miscellaneous manufactured articles", from: 94, to: 96 },
  {
    number: "XXI",
    title: "Works of art, collectors' pieces and antiques",
    from: 97,
    to: 97,
  },
];

/** Standard chapter titles, used only as a fallback when hs_chapter_notes has no title. */
export const HS_STANDARD_CHAPTER_TITLES: Record<string, string> = {
  "71": "Natural or cultured pearls, precious or semi-precious stones, precious metals, metals clad with precious metal, and articles thereof; imitation jewellery; coin",
  "72": "Iron and steel",
  "73": "Articles of iron or steel",
  "74": "Copper and articles thereof",
  "75": "Nickel and articles thereof",
  "76": "Aluminium and articles thereof",
  "77": "(Reserved for possible future use in the Harmonized System)",
  "78": "Lead and articles thereof",
  "79": "Zinc and articles thereof",
  "80": "Tin and articles thereof",
  "81": "Other base metals; cermets; articles thereof",
  "82": "Tools, implements, cutlery, spoons and forks, of base metal; parts thereof of base metal",
  "83": "Miscellaneous articles of base metal",
  "84": "Nuclear reactors, boilers, machinery and mechanical appliances; parts thereof",
  "85": "Electrical machinery and equipment and parts thereof; sound recorders and reproducers, television image and sound recorders and reproducers, and parts and accessories of such articles",
  "86": "Railway or tramway locomotives, rolling-stock and parts thereof; railway or tramway track fixtures and fittings and parts thereof; mechanical (including electro-mechanical) traffic signalling equipment of all kinds",
  "87": "Vehicles other than railway or tramway rolling-stock, and parts and accessories thereof",
  "88": "Aircraft, spacecraft, and parts thereof",
  "89": "Ships, boats and floating structures",
  "90": "Optical, photographic, cinematographic, measuring, checking, precision, medical or surgical instruments and apparatus; parts and accessories thereof",
  "91": "Clocks and watches and parts thereof",
  "92": "Musical instruments; parts and accessories of such articles",
  "93": "Arms and ammunition; parts and accessories thereof",
  "94": "Furniture; bedding, mattresses, mattress supports, cushions and similar stuffed furnishings; luminaires and lighting fittings, not elsewhere specified or included; illuminated signs, illuminated name-plates and the like; prefabricated buildings",
  "95": "Toys, games and sports requisites; parts and accessories thereof",
  "96": "Miscellaneous manufactured articles",
  "97": "Works of art, collectors' pieces and antiques",
};

export function standardSectionForChapter(
  chapter: string,
): { number: string; title: string } | null {
  const n = Number.parseInt(chapter, 10);
  const hit = HS_STANDARD_SECTIONS.find((s) => n >= s.from && n <= s.to);
  return hit ? { number: hit.number, title: hit.title } : null;
}