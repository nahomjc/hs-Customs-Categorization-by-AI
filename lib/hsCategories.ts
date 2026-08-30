import type { NormalizedHs } from "./hsCodeUtils";

/**
 * Map HS chapter/heading to a human category for grouped exports.
 * Covers mixed retail / food packing lists (not only furniture).
 */
export function categoryFromHs(hs: NormalizedHs, description?: string): string {
  const d = (description ?? "").toLowerCase();
  const ch = hs.chapter;
  const head = hs.heading;

  if (/towel|bath\s*linen|bed\s*linen/i.test(d) && ch === "63") return "Textiles";
  if (/towel/i.test(d) && ch === "96") return "Textiles (review HS)";

  const byChapter: Record<string, string> = {
    "02": "Meat and edible meat offal",
    "08": "Fruit and nuts",
    "09": "Coffee, tea, spices",
    "16": "Prepared meat / fish",
    "17": "Sugars and confectionery",
    "19": "Cereal / pasta / bakery",
    "20": "Prepared vegetables and fruit (incl. beverages)",
    "21": "Miscellaneous food preparations",
    "22": "Beverages, vinegar",
    "25": "Salt, minerals",
    "33": "Cosmetics and toiletries",
    "35": "Glues and prepared adhesives",
    "39": "Plastics and plastic articles",
    "44": "Wood and wood articles",
    "48": "Paper and paperboard",
    "61": "Apparel (knitted)",
    "62": "Apparel (not knitted)",
    "63": "Textiles",
    "69": "Ceramic products",
    "70": "Glass and glassware",
    "73": "Iron or steel articles",
    "76": "Aluminium articles",
    "82": "Tools and cutlery",
    "83": "Base metal fittings",
    "84": "Machinery and mechanical appliances",
    "85": "Electrical machinery and equipment",
    "94": "Furniture and bedding",
    "95": "Toys, games and sports equipment",
    "96": "Miscellaneous manufactured articles",
  };

  if (byChapter[ch]) return byChapter[ch];

  if (head.startsWith("94")) return "Furniture";
  if (head.startsWith("85")) return "Electrical equipment";
  if (head.startsWith("84")) return "Machinery";
  if (head.startsWith("69")) return "Ceramic products";
  if (head.startsWith("48")) return "Paper and paperboard";

  return `HS heading ${head}`;
}
