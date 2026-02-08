/**
 * Splits extracted text into raw item lines and detects description, quantity, unit.
 * Handles messy packing list format: "Description Country N PCS" or "Description  N  PCS"
 */
const UNIT_PATTERN =
  /\b(PCS|PC|Pieces?|SETS?|SET|UNITS?|BOX(?:ES)?|CARTONS?|ROLLS?|SQM|M2|KG|KGS|LBS|METERS?|M\b|NO\.?S?\.?)\s*$/i;
const NUMBER_PATTERN = /(\d+(?:\.\d+)?)\s*$/;

export interface ParsedLine {
  rawLine: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  lineIndex: number;
}

export function parseLines(extractedText: string): ParsedLine[] {
  const lines = extractedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  const result: ParsedLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const { description, quantity, unit } = parseOneLine(raw);
    result.push({
      rawLine: raw,
      description,
      quantity,
      unit,
      lineIndex: i,
    });
  }
  return result;
}

function parseOneLine(line: string): {
  description: string;
  quantity: number | null;
  unit: string | null;
} {
  let rest = line;
  let quantity: number | null = null;
  let unit: string | null = null;

  const unitMatch = rest.match(UNIT_PATTERN);
  if (unitMatch) {
    unit = unitMatch[1].toUpperCase().replace(/\s+/g, "");
    rest = rest.slice(0, unitMatch.index).trim();
  }

  const numMatch = rest.match(NUMBER_PATTERN);
  if (numMatch) {
    quantity = parseFloat(numMatch[1]);
    rest = rest.slice(0, numMatch.index).trim();
  }

  const description = rest.replace(/\s+/g, " ").trim() || line;
  return { description, quantity, unit };
}
